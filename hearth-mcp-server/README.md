# Hearth MCP Server

MCP (Model Context Protocol) server for **Hearth** — personalized AI context through memory retrieval, affect detection, and operating specifications.

Instead of intercepting API calls and injecting context (the Chrome extension approach), this server lets AI models **reach out and pull** the context they need. The model becomes a willing participant in the personalization process, not an unknowing recipient.

## What It Exposes

### Resources (model reads these)
- `hearth://opspec` — The user's Operating Specification. Defines WHO the model should be.
- `hearth://composition-rules` — How the Hearth stack layers compose together.

### Tools (model calls these)
- `hearth_retrieve_memories` — Semantic search with heat-gated composite scoring
- `hearth_detect_affect` — 3-axis emotional state detection → prescriptive complement
- `hearth_store_memory` — Bidirectional memory creation (model writes memories)
- `hearth_list_memories` — Browse memory store without semantic search
- `hearth_get_patterns` — Behavioral patterns detected across conversations
- `hearth_validate_memory` — Update memory validation state from conversation evidence

## Setup

### Prerequisites
- Node.js 18+
- A Supabase project with the Hearth schema (memories table with pgvector)
- An OpenAI API key (for generating query embeddings)

### Install
```bash
cd hearth-mcp-server
npm install
npm run build
```

### Environment Variables
```bash
export SUPABASE_URL="https://wkfwtivvhwyjlkyrikeu.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"
export OPENAI_API_KEY="your-openai-key"

# Optional: transport mode (default: stdio)
export TRANSPORT="stdio"  # or "http" for hosted deployment
export PORT="3001"        # only used with http transport
```

### Run locally (stdio — for Claude Desktop)
```bash
npm start
```

### Run as HTTP server (for hosted deployment)
```bash
TRANSPORT=http PORT=3001 npm start
```

## Connecting to Claude

### Claude Desktop (local/stdio)
Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "hearth": {
      "command": "node",
      "args": ["/path/to/hearth-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://wkfwtivvhwyjlkyrikeu.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-role-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

### Claude.ai (hosted/HTTP)
Deploy the HTTP server and connect via the MCP integrations panel in Claude.ai settings.

## Architecture

```
User message → Claude reads hearth://opspec
             → Claude calls hearth_detect_affect(message)
             → Claude calls hearth_retrieve_memories(query, heat)
             → Claude responds with full Hearth context
             → Claude optionally calls hearth_store_memory() for new insights
```

The key difference from the Chrome extension: **Claude decides** when to check affect and retrieve memories, rather than having context blindly prepended to every message.

## Development

```bash
npm run dev    # Watch mode — rebuilds on file changes
npm run build  # One-time build
npm start      # Run the built server
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web UI where you can test each tool and resource interactively.
