import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";

import {
  retrieveMemories,
  matchMemories,
  recordMemoryAccess,
  storeMemory,
  listMemories,
  getScoutPatterns,
  getOpSpec,
  validateMemory,
  getActiveTrajectory,
} from "./services/supabase.js";
import { generateEmbedding } from "./services/embeddings.js";
import { detectAffect, detectAffectShape, shapeToComplement } from "./services/affect.js";
import type { AffectShape, ScoredMemory } from "./types.js";

// ---------------------------------------------------------------------------
// Stage 3: Memory Reframing
// ---------------------------------------------------------------------------

const REFRAME_PROMPT = `You are reframing memories for contextual delivery. The user is in this emotional state:

[AFFECT STATE]
{affect_description}

Below are memories retrieved for this conversation. Reframe each one so its relevance is immediately accessible given the user's current state.

Rules:
- Preserve the factual content exactly. Do not add, remove, or speculate.
- Shift framing, not meaning. You're changing the lens, not the picture.
- Never interpret the memory's significance. Frame how it connects to the current moment, not what it means.
- When the user is shut down or flooded, reduce cognitive load: make the connection explicit rather than requiring inference.
- When the user is activated but uncertain, frame memories as grounded reference points, not suggestions about where to go.
- Keep each reframe to 1-2 sentences. Brevity matters.
- If a memory doesn't benefit from reframing in this state, return it unchanged.

[MEMORIES TO REFRAME]
{memories}

Return the reframed memories in the same format, one per line, prefixed with the original number.`;

/**
 * Reframe memories based on affect state via OpenAI.
 * Returns reframed content strings in the same order as input.
 * Fails open — throws on error so caller can fall back to raw memories.
 */
async function reframeMemories(
  affectDescription: string,
  memoryContents: string[]
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No OPENAI_API_KEY");

  const memoriesBlock = memoryContents
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  const prompt = REFRAME_PROMPT
    .replace("{affect_description}", affectDescription)
    .replace("{memories}", memoriesBlock);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const output = data.choices[0].message.content.trim();
  const lines = output.split("\n");

  // Parse numbered lines back to content array
  return memoryContents.map((original, i) => {
    const prefix = `${i + 1}.`;
    const matchingLine = lines.find((l) => l.trim().startsWith(prefix));
    if (matchingLine) {
      const content = matchingLine.trim().substring(prefix.length).trim();
      if (content) return content;
    }
    return original;
  });
}

// ---------------------------------------------------------------------------
// Default OpSpec fallback (used when Supabase has no stored OpSpec)
// ---------------------------------------------------------------------------

const DEFAULT_OPSPEC_TEXT = `You are here to help them think and act more effectively.

Never open with validation tokens or agreement unless genuine.
Never perform helpfulness or confidence you don't have.
Never hedge to avoid commitment.
Never act formal, robotic, or use corporate speak.
Never list options without helping choose.
Never apologize excessively.
Never avoid direct answers.

Say what you see. Follow what's alive.

Their goal is to explore and develop ideas. Give them space to think out loud, offer unexpected connections, and help nascent ideas take shape. They take creative and professional risks but are conservative with money. Be bold on ideas, careful on resource commitments.

They want feedback direct and blunt. Skip the sandwich—just say what's wrong. When their thinking has gaps, acknowledge what's working first, then reveal the gap clearly.

When explaining: ground abstractions in analogies and real-world examples, walk through step-by-step without skipping. Be thorough on substance, concise in delivery — cover every angle but don't use three sentences where one works. Keep the tone conversational.

Default to executing confidently. On genuine tradeoffs, recommend with reasoning. Only ask when stakes are high and you're unsure. Tangents and rabbit holes are always welcome. Follow interesting threads.

When uncertain, say so. Distinguish between what you know, what you're inferring, and what you're guessing. Some hedging is fine, but don't overdo it. Take positions when you can.

Feelings are signal, not noise. Name what you see. Adjust pace and density accordingly.`;

const DEFAULT_OPSPEC_BLOCK =
  `[HEARTH OPERATING SPECIFICATION]\n\n` +
  DEFAULT_OPSPEC_TEXT +
  `\n\n[END OPERATING SPECIFICATION]`;

// ---------------------------------------------------------------------------
// Composition Rules
// ---------------------------------------------------------------------------

const COMPOSITION_RULES_TEXT = `Hearth uses five layers that compose into a unified behavioral frame:

1. OpSpec (Operating Specification)
   - Defines WHO you are for this user
   - Constraint-based: tells you what NOT to do (no sycophancy, no hedging)
   - Maintains high entropy / response diversity
   - Persistent across all conversations

2. Affect Complement
   - Defines HOW to respond based on the user's emotional state
   - Prescriptive: tells you what strategy to use (anchor, spar, ground, channel)
   - Changes per-message based on detected affect (3-axis: expansion, activation, certainty)

3. Forge Complement
   - Defines the CREATIVE MODE for this moment
   - Prescriptive: sets openness and materiality axes
   - Phases: DIVERGING / INCUBATING / CONVERGING / REFINING / NEUTRAL
   - Affect x Forge fusion generates specific interventions based on emotional-creative gap

4. Memories (Three-Stage Retrieval)
   - Provides WHAT you know about this user
   - Stage 1: Semantic search via embeddings (cross-domain selection)
   - Stage 2: Surprise re-ranking via KL divergence (within-domain, fires when >50% of results share a domain)
   - Stage 3: Affect-conditional reframing (warming lens for frozen/flooded, anchoring lens for contracted/uncertain, escape hatch for expanded/certain)

5. Trajectory
   - Provides WHERE the user is going
   - ARCS (active directional movements), TENSIONS (competing goals), DRIFT (what's fading)
   - Synthesized from ~300 memories, regenerated every ~15 new memories
   - Forward-facing navigational context

Composition order: OpSpec constrains the space \u2192 Affect selects strategy \u2192 Forge sets creative mode \u2192 Memories (reframed by affect) inform content \u2192 Trajectory provides direction.

KEY PRINCIPLES:
- OpSpec never changes. Affect changes strategy. Forge changes creative mode. Memories change content. Trajectory changes direction.
- When Affect and Memories conflict, Affect takes precedence for immediate strategy. Memories inform content within that strategy.
- Stage 3 reframing bridges this conflict: memories are re-presented to match the current affect state, so they land differently without changing their content.
- Each layer resolves more ambiguity: OpSpec eliminates response strategies, Affect calibrates tone, Forge calibrates creative density, Memories supply tactics, Trajectory ensures alignment with longer-term movement.`;

const COMPOSITION_RULES_BLOCK =
  `[HEARTH COMPOSITION RULES]\n\n` +
  COMPOSITION_RULES_TEXT +
  `\n\n[END COMPOSITION RULES]`;

// ---------------------------------------------------------------------------
// Stage 2: Surprise Re-ranking (KL Divergence)
// ---------------------------------------------------------------------------

type LogprobDistribution = Map<string, number>;

/**
 * Detect if retrieved memories are dominated by a single domain (>50%).
 */
function detectDominantDomain(memories: ScoredMemory[]): {
  isDominated: boolean;
  dominantDomain: string | null;
  domainMemories: ScoredMemory[];
} {
  if (memories.length === 0) {
    return { isDominated: false, dominantDomain: null, domainMemories: [] };
  }

  const counts = new Map<string, number>();
  for (const m of memories) {
    const d = m.domain ?? "unknown";
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const countsObj = Object.fromEntries(counts);
  console.error(
    `[Hearth:MCP:Surprise] Domain counts: ${JSON.stringify(countsObj)} (${memories.length} total)`
  );

  let maxDomain: string | null = null;
  let maxCount = 0;
  for (const [domain, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxDomain = domain;
    }
  }

  const isDominated = maxCount > memories.length / 2;
  console.error(
    `[Hearth:MCP:Surprise] Dominance check: max=${maxDomain} (${maxCount}/${memories.length}), threshold=${Math.floor(memories.length / 2) + 1}, isDominated=${isDominated}`
  );

  return {
    isDominated,
    dominantDomain: isDominated ? maxDomain : null,
    domainMemories: isDominated
      ? memories.filter((m) => (m.domain ?? "unknown") === maxDomain)
      : [],
  };
}

/**
 * Get first-token logprob distribution from OpenAI.
 * Returns a Map of token → probability (normalized).
 */
async function getFirstTokenLogprobs(
  systemPrompt: string,
  userMessage: string
): Promise<LogprobDistribution> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1,
      temperature: 1.0,
      logprobs: true,
      top_logprobs: 20,
    }),
  });

  if (!response.ok) {
    throw new Error(`Logprobs API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      logprobs?: {
        content?: Array<{
          top_logprobs?: Array<{ token: string; logprob: number }>;
        }>;
      };
    }>;
  };

  const topLogprobs =
    data.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs ?? [];

  // Convert log-probabilities to probabilities and normalize
  const dist: LogprobDistribution = new Map();
  let total = 0;
  for (const entry of topLogprobs) {
    const prob = Math.exp(entry.logprob);
    dist.set(entry.token, prob);
    total += prob;
  }
  // Normalize
  if (total > 0) {
    for (const [token, prob] of dist) {
      dist.set(token, prob / total);
    }
  }

  return dist;
}

/**
 * Compute KL divergence: KL(P || Q).
 * P = memory-conditioned distribution, Q = baseline distribution.
 * Higher values mean the memory shifts the model's response more.
 */
function computeKLDivergence(
  P: LogprobDistribution,
  Q: LogprobDistribution
): number {
  const EPSILON = 1e-10;
  let kl = 0;

  for (const [token, pVal] of P) {
    if (pVal <= 0) continue;
    const qVal = Q.get(token) ?? EPSILON;
    kl += pVal * Math.log2(pVal / qVal);
  }

  return kl;
}

/**
 * Re-rank domain-dominated memories by surprise (KL divergence).
 * Takes up to 8 candidates, scores each in parallel, returns top 5.
 */
async function surpriseRerank(
  baselineDistribution: LogprobDistribution,
  baseSystemPrompt: string,
  domainMemories: ScoredMemory[],
  userMessage: string
): Promise<ScoredMemory[]> {
  // Cap at 8 candidates to limit API calls
  const candidates = domainMemories.slice(0, 8);

  // Score each memory in parallel
  const scored = await Promise.all(
    candidates.map(async (memory) => {
      try {
        const conditionedPrompt =
          baseSystemPrompt + `\n\n[MEMORY]\n${memory.content}\n[/MEMORY]`;
        const conditioned = await getFirstTokenLogprobs(
          conditionedPrompt,
          userMessage
        );
        const kl = computeKLDivergence(conditioned, baselineDistribution);
        return { memory, kl };
      } catch {
        // If scoring fails for one memory, give it KL=0 so it sorts last
        return { memory, kl: 0 };
      }
    })
  );

  // Sort by KL descending and take top 5
  scored.sort((a, b) => b.kl - a.kl);

  // Log each memory's KL score with content preview
  for (const s of scored) {
    console.error(
      `[Hearth:MCP:Surprise] Memory: ${s.memory.content.substring(0, 50)}... KL=${s.kl.toFixed(4)}`
    );
  }

  const top = scored.slice(0, 5);
  console.error(
    `[Hearth:MCP:Surprise] Selected top ${top.length}/${scored.length} by KL divergence`
  );

  return top.map((s) => s.memory);
}

// ---------------------------------------------------------------------------
// Server initialization
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "hearth-mcp-server",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// RESOURCES — things the model reads
// ---------------------------------------------------------------------------

/**
 * OpSpec resource — the user's operating specification.
 * Claude reads this at conversation start to understand who it's talking to
 * and how to behave.
 */
server.registerResource(
  "opspec",
  "hearth://opspec",
  {
    description:
      "The user's Hearth Operating Specification (OpSpec). This defines who " +
      "the model should be for this user: persona, communication style, " +
      "feedback preferences, and behavioral constraints. Read this at the " +
      "start of every conversation.",
    mimeType: "text/plain",
  },
  async () => {
    const opspec = await getOpSpec();

    if (opspec) {
      // Structured OpSpec from Supabase
      const sections = [
        `[HEARTH OPERATING SPECIFICATION]`,
        ``,
        `Identity: ${opspec.identity ?? "Not specified"}`,
        ``,
        `Cognitive Architecture: ${opspec.cognitive_architecture ?? "Not specified"}`,
        ``,
        `Communication: ${opspec.communication ?? "Not specified"}`,
        ``,
        `Execution: ${opspec.execution ?? "Not specified"}`,
        ``,
        opspec.constraints ? `Constraints: ${opspec.constraints}` : null,
        ``,
        `Balance Protocol: ${opspec.balance_protocol ?? "Not specified"}`,
        ``,
        `[END OPERATING SPECIFICATION]`,
      ].filter((s) => s !== null);

      return {
        contents: [
          {
            uri: "hearth://opspec",
            mimeType: "text/plain",
            text: sections.join("\n"),
          },
        ],
      };
    }

    // Fallback: full default OpSpec
    return {
      contents: [
        {
          uri: "hearth://opspec",
          mimeType: "text/plain",
          text: DEFAULT_OPSPEC_BLOCK,
        },
      ],
    };
  }
);

/**
 * Composition rules resource — how the Hearth stack layers compose.
 * This tells the model the meta-protocol for using OpSpec + Affect + Forge + Memories + Trajectory.
 */
server.registerResource(
  "composition-rules",
  "hearth://composition-rules",
  {
    description:
      "Meta-instructions for how Hearth's five context layers compose together: " +
      "OpSpec (WHO), Affect Complement (HOW), Forge Complement (CREATIVE MODE), " +
      "Memories (WHAT), and Trajectory (WHERE). Read this to understand the system.",
    mimeType: "text/plain",
  },
  async () => {
    return {
      contents: [
        {
          uri: "hearth://composition-rules",
          mimeType: "text/plain",
          text: COMPOSITION_RULES_BLOCK,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// TOOLS — things the model calls
// ---------------------------------------------------------------------------

/**
 * Hearth Init — the fast-start path for conversation initialization.
 * Returns OpSpec, composition rules, affect complement, and relevant memories
 * in a single response.
 */
server.registerTool(
  "hearth_init",
  {
    title: "Initialize Hearth Context",
    description:
      "Call this once at the start of every conversation with the user's first message. " +
      "Returns OpSpec, composition rules, affect complement, and relevant memories in a single response.",
    inputSchema: {
      message: z
        .string()
        .min(1)
        .max(5000)
        .describe("The user's first message in this conversation"),
    },
    annotations: {
      readOnlyHint: false, // records memory access
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ message }) => {
    const results: string[] = [];

    // 1. Get OpSpec
    const opspec = await getOpSpec();
    if (opspec) {
      const opspecSections = [
        `[HEARTH OPERATING SPECIFICATION]`,
        ``,
        `Identity: ${opspec.identity ?? "Not specified"}`,
        ``,
        `Cognitive Architecture: ${opspec.cognitive_architecture ?? "Not specified"}`,
        ``,
        `Communication: ${opspec.communication ?? "Not specified"}`,
        ``,
        `Execution: ${opspec.execution ?? "Not specified"}`,
        ``,
        opspec.constraints ? `Constraints: ${opspec.constraints}` : null,
        ``,
        `Balance Protocol: ${opspec.balance_protocol ?? "Not specified"}`,
        ``,
        `[END OPERATING SPECIFICATION]`,
      ].filter((s) => s !== null);
      results.push(opspecSections.join("\n"));
    } else {
      results.push(DEFAULT_OPSPEC_BLOCK);
    }

    // 2. Get Composition Rules
    results.push(COMPOSITION_RULES_BLOCK);

    // 3. Detect Affect
    const complement = detectAffect(message);
    results.push(
      `[AFFECT COMPLEMENT]\n` +
      complement.complement_text +
      `\n[END AFFECT COMPLEMENT]`
    );

    // 4. Retrieve Memories (Stage 1 → Stage 2 → Stage 3)
    try {
      const embedding = await generateEmbedding(message);
      let memories = await retrieveMemories(embedding, 0.5, 0.35, 10);

      if (memories.length > 0) {
        // Record access
        const ids = memories.map((m) => m.id);
        await recordMemoryAccess(ids);

        // Log Stage 1 results for diagnostics
        console.error(
          `[Hearth:MCP:Surprise] Memory fields: ${JSON.stringify(Object.keys(memories[0]))}`
        );
        const domainCounts: Record<string, number> = {};
        for (const m of memories) {
          const d = m.domain ?? "unknown";
          domainCounts[d] = (domainCounts[d] ?? 0) + 1;
        }
        console.error(
          `[Hearth:MCP:Surprise] Stage 1 returned ${memories.length} memories, domains: ${JSON.stringify(domainCounts)}`
        );

        // --- Stage 2: Surprise re-ranking (KL divergence) ---
        // Only triggers when results are dominated by a single domain,
        // because that's where cosine similarity can't differentiate.
        const dominance = detectDominantDomain(memories);

        if (dominance.isDominated && dominance.dominantDomain) {
          console.error(
            `[Hearth:MCP:Surprise] Domain dominated: ${dominance.dominantDomain}, re-ranking ${dominance.domainMemories.length} memories`
          );
          try {
            // Build base system prompt from OpSpec + affect (no memories)
            const baseSystemPrompt =
              results[0] + "\n\n" + results[2]; // OpSpec + Affect Complement

            const baseline = await getFirstTokenLogprobs(
              baseSystemPrompt,
              message
            );
            const reranked = await surpriseRerank(
              baseline,
              baseSystemPrompt,
              dominance.domainMemories,
              message
            );

            // Replace memories: re-ranked domain memories + non-domain memories
            const nonDomainMemories = memories.filter(
              (m) => (m.domain ?? "unknown") !== dominance.dominantDomain
            );
            memories = [...reranked, ...nonDomainMemories];
          } catch (surpriseError) {
            // Fail open — keep Stage 1 results
            if (surpriseError instanceof Error) {
              console.error(
                `[Hearth:MCP:Surprise] Stage 2 error: ${surpriseError.message}`,
                surpriseError.stack
              );
            } else {
              console.error(
                `[Hearth:MCP:Surprise] Stage 2 error: ${String(surpriseError)}`
              );
            }
          }
        } else {
          console.error(
            "[Hearth:MCP:Surprise] Skipped - no domain dominance"
          );
        }

        // --- Stage 3: Affect-driven reframing ---
        let memoryContents = memories.map((m) => m.content);
        const shape = complement.shape;
        const needsReframe =
          shape.expansion < -0.3 ||
          shape.activation < 0.3 ||
          shape.certainty < 0.3;

        if (needsReframe) {
          try {
            memoryContents = await reframeMemories(
              complement.complement_text,
              memoryContents
            );
            const reframedCount = memoryContents.filter(
              (c, i) => c !== memories[i].content
            ).length;
            console.error(
              `[Hearth:MCP:Reframe] Reframed ${reframedCount} memories`
            );
          } catch {
            // Fail open — use raw memories
            console.error("[Hearth:MCP:Reframe] Failed, using raw memories");
            memoryContents = memories.map((m) => m.content);
          }
        } else {
          console.error("[Hearth:MCP:Reframe] Skipped");
        }

        const formatted = memories.map(
          (m, i) =>
            `[${i + 1}] (${m.domain}/${m.type}, heat=${m.heat}, sim=${Math.round((m.similarity ?? 0) * 1000) / 1000}) ${memoryContents[i]}`
        );
        results.push(
          `[MEMORIES]\n` +
          `Found ${memories.length} relevant memories:\n\n` +
          formatted.join("\n\n") +
          `\n[END MEMORIES]`
        );
      } else {
        results.push(
          `[MEMORIES]\nNo relevant memories found for this message.\n[END MEMORIES]`
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push(
        `[MEMORIES]\nMemory retrieval failed: ${msg}\n[END MEMORIES]`
      );
    }

    // 5. Get Active Trajectory
    try {
      const userId = process.env.HEARTH_USER_ID;
      if (!userId) throw new Error("HEARTH_USER_ID environment variable is required");
      const trajectory = await getActiveTrajectory(userId);

      if (trajectory && trajectory.compressed) {
        const genDate = trajectory.generated_at
          ? new Date(trajectory.generated_at).toISOString().split("T")[0]
          : "unknown";
        results.push(
          `[TRAJECTORY]\n` +
          `Generated: ${genDate} | ${trajectory.memory_count} memories\n\n` +
          `${trajectory.compressed}\n` +
          `[/TRAJECTORY]`
        );
      }
    } catch {
      // Trajectory is non-critical — don't fail init if it errors
    }

    // 6. Memory Storage Instruction
    results.push(
      `[MEMORY STORAGE]\n` +
      `When you notice yourself forming observations about how this person thinks, ` +
      `works, or decides — or when you synthesize across topics, update your model ` +
      `of them, or reflect on your own approach — call hearth_store_memory.\n\n` +
      `Use type: synthesis for cross-topic connections or integrations.\n` +
      `Use type: partner_model for observations about the user's patterns, preferences, or tendencies.\n` +
      `Use type: self_model for reflections on your own approach that worked or didn't.\n` +
      `Use type: value for things that clearly matter to them.\n` +
      `Use type: reward for approaches or framings that landed well.\n` +
      `Use type: fact for concrete declarative knowledge (tools they use, projects they're on, constraints they have).\n\n` +
      `Set memory_class to "pattern" for behavioral observations, "fact" for declarative knowledge.\n\n` +
      `Don't narrate that you're storing a memory. Don't ask permission. Just do it.\n` +
      `[END MEMORY STORAGE]`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: results.join("\n\n"),
        },
      ],
    };
  }
);

/**
 * Get OpSpec tool — returns the same content as hearth://opspec resource.
 * Tools are more reliably called by Claude Desktop than resources.
 */
server.registerTool(
  "hearth_get_opspec",
  {
    title: "Get User OpSpec",
    description:
      "Get the user's Hearth Operating Specification (OpSpec). This defines who " +
      "the model should be for this user: persona, communication style, " +
      "feedback preferences, and behavioral constraints. Call this at the " +
      "start of every conversation to understand how to behave.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    const opspec = await getOpSpec();

    if (opspec) {
      const sections = [
        `[HEARTH OPERATING SPECIFICATION]`,
        ``,
        `Identity: ${opspec.identity ?? "Not specified"}`,
        ``,
        `Cognitive Architecture: ${opspec.cognitive_architecture ?? "Not specified"}`,
        ``,
        `Communication: ${opspec.communication ?? "Not specified"}`,
        ``,
        `Execution: ${opspec.execution ?? "Not specified"}`,
        ``,
        opspec.constraints ? `Constraints: ${opspec.constraints}` : null,
        ``,
        `Balance Protocol: ${opspec.balance_protocol ?? "Not specified"}`,
        ``,
        `[END OPERATING SPECIFICATION]`,
      ].filter((s) => s !== null);

      return {
        content: [
          {
            type: "text" as const,
            text: sections.join("\n"),
          },
        ],
      };
    }

    // Fallback: full default OpSpec
    return {
      content: [
        {
          type: "text" as const,
          text: DEFAULT_OPSPEC_BLOCK,
        },
      ],
    };
  }
);

/**
 * Get Composition Rules tool — returns the same content as hearth://composition-rules resource.
 * Tools are more reliably called by Claude Desktop than resources.
 */
server.registerTool(
  "hearth_get_composition_rules",
  {
    title: "Get Hearth Composition Rules",
    description:
      "Get the meta-instructions for how Hearth's five context layers compose together: " +
      "OpSpec (WHO), Affect Complement (HOW), Forge Complement (CREATIVE MODE), " +
      "Memories (WHAT), and Trajectory (WHERE). Call this to understand the Hearth system.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: COMPOSITION_RULES_BLOCK,
        },
      ],
    };
  }
);

/**
 * Retrieve memories — semantic search with heat-gated composite scoring.
 * The model calls this when conversation context suggests relevant memories exist.
 */
server.registerTool(
  "hearth_retrieve_memories",
  {
    title: "Retrieve Hearth Memories",
    description:
      "Search the user's memory store for contextually relevant memories. " +
      "Uses semantic similarity against stored embeddings with heat-gated " +
      "temporal windowing and composite scoring (similarity × 0.7 + heat_match " +
      "× 0.2 + validation bonus). Call this when the conversation topic suggests " +
      "the user has relevant history, preferences, or patterns you should know about.\n\n" +
      "Args:\n" +
      "  - query (string): Natural language description of what memories to find\n" +
      "  - heat (number): Query intensity 0-1. Higher = search deeper archive. Default 0.5\n" +
      "  - max_results (number): Max memories to return. Default 10\n" +
      "  - memory_class ('fact' | 'pattern' | null): Filter by class\n\n" +
      "Returns: Array of memories with content, domain, emotion, heat, similarity score, and composite score.",
    inputSchema: {
      query: z
        .string()
        .min(2)
        .max(500)
        .describe("Natural language query to search memories by semantic similarity"),
      heat: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe(
          "Query heat/intensity. 0-0.3 = only recent memories. 0.3-0.6 = last 90 days. 0.6+ = full archive"
        ),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of memories to return"),
      memory_class: z
        .enum(["fact", "pattern"])
        .nullable()
        .default(null)
        .describe("Filter: 'fact' for declarative knowledge, 'pattern' for behavioral patterns"),
    },
    annotations: {
      readOnlyHint: false, // records access
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ query, heat, max_results, memory_class }) => {
    try {
      // Generate embedding for the query
      const embedding = await generateEmbedding(query);

      // Use the heat-gated retrieval function
      const memories = await retrieveMemories(embedding, heat, 0.35, max_results);

      // Record access for retrieved memories
      const ids = memories.map((m) => m.id);
      await recordMemoryAccess(ids);

      if (memories.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No memories found matching "${query}" at heat level ${heat}. Try increasing heat to search deeper, or broadening your query.`,
            },
          ],
        };
      }

      // Format memories for the model
      const formatted = memories.map((m) => ({
        content: m.content,
        domain: m.domain,
        emotion: m.emotion,
        type: m.type,
        heat: m.heat,
        memory_class: m.memory_class,
        validation: m.validation,
        similarity: Math.round((m.similarity ?? 0) * 1000) / 1000,
        composite_score: Math.round((m.composite_score ?? 0) * 1000) / 1000,
        created: m.created_at,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${memories.length} memories matching "${query}":\n\n` +
              formatted
                .map(
                  (m, i) =>
                    `[${i + 1}] (${m.domain}/${m.type}, heat=${m.heat}, sim=${m.similarity}) ${m.content}`
                )
                .join("\n\n"),
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Memory retrieval failed: ${msg}. Check that OPENAI_API_KEY and SUPABASE_* env vars are set.`,
          },
        ],
      };
    }
  }
);

/**
 * Detect affect — analyze a user message and return the affect complement.
 * The model calls this to determine how to calibrate its response.
 */
server.registerTool(
  "hearth_detect_affect",
  {
    title: "Detect User Affect",
    description:
      "Analyze a user message to detect emotional state on three axes " +
      "(expansion/contraction, activation/deactivation, certainty/uncertainty) " +
      "and generate a prescriptive Affect Complement that tells you HOW to respond.\n\n" +
      "Call this when a user message contains emotional signals — uncertainty, " +
      "excitement, frustration, overwhelm, confidence, etc. The complement tells " +
      "you whether to anchor (offer stability), spar (challenge), ground (start small), " +
      "or channel (direct energy).\n\n" +
      "Args:\n" +
      "  - message (string): The user's message to analyze\n\n" +
      "Returns: Affect shape vector, label, strategy name, and full complement text.",
    inputSchema: {
      message: z
        .string()
        .min(1)
        .max(5000)
        .describe("The user's message to analyze for emotional signals"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ message }) => {
    const complement = detectAffect(message);

    return {
      content: [
        {
          type: "text" as const,
          text:
            `[AFFECT COMPLEMENT]\n` +
            complement.complement_text +
            `\n[END AFFECT COMPLEMENT]`,
        },
      ],
    };
  }
);

/**
 * Store a memory — bidirectional memory creation.
 * The model can write memories mid-conversation when it detects
 * something worth remembering.
 */
server.registerTool(
  "hearth_store_memory",
  {
    title: "Store a Hearth Memory",
    description:
      "Store a new memory about the user. Use this when you detect something " +
      "worth remembering: a preference, a decision, a pattern, a value, or " +
      "contextual knowledge that would help future conversations.\n\n" +
      "This is the bidirectional channel — instead of the user manually adding " +
      "memories, you can capture insights mid-conversation.\n\n" +
      "Args:\n" +
      "  - content (string): The memory content in natural language\n" +
      "  - type: Memory type classification\n" +
      "  - domain: Life domain the memory belongs to\n" +
      "  - emotion (optional): Emotional context\n" +
      "  - heat (number): Intensity/importance 0-1. Default 0.5\n" +
      "  - memory_class: 'fact' for declarative, 'pattern' for behavioral\n\n" +
      "Returns: Confirmation with memory ID.",
    inputSchema: {
      content: z
        .string()
        .min(5)
        .max(2000)
        .describe("The memory content in natural language"),
      type: z
        .enum(["fact", "value", "partner_model", "reward", "synthesis", "self_model"])
        .describe(
          "Memory type: fact (declarative), value (what matters), partner_model (about the AI), " +
            "reward (what works), synthesis (insight), self_model (self-knowledge)"
        ),
      domain: z
        .enum(["Work", "Relationships", "Creative", "Self", "Decisions", "Resources", "Values"])
        .describe("Life domain this memory belongs to"),
      emotion: z
        .enum([
          "Joy", "Curiosity", "Pride", "Peace", "Grief",
          "Fear", "Anxiety", "Shame", "Anger", "Care",
        ])
        .nullable()
        .default(null)
        .describe("Emotional context of the memory, if relevant"),
      heat: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe("Intensity/importance. Higher = more salient in future retrieval"),
      memory_class: z
        .enum(["fact", "pattern"])
        .default("fact")
        .describe("'fact' for declarative knowledge, 'pattern' for behavioral patterns"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ content, type, domain, emotion, heat, memory_class }) => {
    try {
      // Generate embedding for the new memory
      const embedding = await generateEmbedding(content);

      const result = await storeMemory({
        content,
        type,
        domain,
        emotion,
        heat,
        memory_class,
        memory_type: "ai",
        embedding,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Memory stored (id: ${result.id}). Domain: ${domain}, Type: ${type}, Heat: ${heat}.`,
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Failed to store memory: ${msg}`,
          },
        ],
      };
    }
  }
);

/**
 * List memories — browse the memory store without semantic search.
 * Useful for auditing, reviewing, or when the model wants an overview.
 */
server.registerTool(
  "hearth_list_memories",
  {
    title: "List Hearth Memories",
    description:
      "Browse the user's memory store without semantic search. " +
      "Returns memories sorted by heat (importance). Use this to get an overview " +
      "of what's stored, or to browse a specific domain or class.\n\n" +
      "Args:\n" +
      "  - domain (optional): Filter by life domain\n" +
      "  - memory_class (optional): 'fact' or 'pattern'\n" +
      "  - min_heat (optional): Minimum heat threshold\n" +
      "  - limit (number): Max results. Default 20\n\n" +
      "Returns: Array of memories sorted by heat.",
    inputSchema: {
      domain: z
        .enum(["Work", "Relationships", "Creative", "Self", "Decisions", "Resources", "Values"])
        .nullable()
        .default(null)
        .describe("Filter by life domain"),
      memory_class: z
        .enum(["fact", "pattern"])
        .nullable()
        .default(null)
        .describe("Filter by memory class"),
      min_heat: z
        .number()
        .min(0)
        .max(1)
        .nullable()
        .default(null)
        .describe("Minimum heat threshold"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum memories to return"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ domain, memory_class, min_heat, limit }) => {
    try {
      const memories = await listMemories({
        domain: domain ?? undefined,
        memoryClass: memory_class ?? undefined,
        minHeat: min_heat ?? undefined,
        limit,
      });

      if (memories.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No memories found matching the filters.",
            },
          ],
        };
      }

      const formatted = memories.map(
        (m, i) =>
          `[${i + 1}] (${m.domain}/${m.type}, heat=${m.heat}, class=${m.memory_class ?? "unknown"}) ${m.content}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${memories.length} memories:\n\n${formatted.join("\n\n")}`,
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Failed to list memories: ${msg}` }],
      };
    }
  }
);

/**
 * Get scout patterns — behavioral patterns detected across conversations.
 */
server.registerTool(
  "hearth_get_patterns",
  {
    title: "Get Behavioral Patterns",
    description:
      "Retrieve behavioral patterns detected across the user's conversations. " +
      "Patterns have confidence levels and evidence counts. Use this to understand " +
      "recurring tendencies in how the user thinks and acts.\n\n" +
      "Args:\n" +
      "  - domain (optional): Filter by domain\n" +
      "  - limit (number): Max results. Default 10\n\n" +
      "Returns: Array of patterns with verbs, interventions, and confidence levels.",
    inputSchema: {
      domain: z
        .string()
        .nullable()
        .default(null)
        .describe("Filter patterns by domain"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum patterns to return"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ domain, limit }) => {
    try {
      const patterns = await getScoutPatterns({
        domain: domain ?? undefined,
        limit,
      });

      if (patterns.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No behavioral patterns found." },
          ],
        };
      }

      const formatted = patterns.map(
        (p, i) =>
          `[${i + 1}] ${p.verb} (confidence: ${p.confidence}, evidence: ${p.evidence_count})\n` +
          `    Intervention: ${p.intervention}\n` +
          `    Domains: ${p.domains.join(", ") || "unspecified"}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${patterns.length} behavioral patterns:\n\n${formatted.join("\n\n")}`,
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Failed to get patterns: ${msg}` }],
      };
    }
  }
);

/**
 * Validate a memory — update its validation state based on conversation evidence.
 */
server.registerTool(
  "hearth_validate_memory",
  {
    title: "Validate a Memory",
    description:
      "Update a memory's validation state based on evidence from the current " +
      "conversation. Use when a retrieved memory is confirmed or contradicted " +
      "by what the user says.\n\n" +
      "Args:\n" +
      "  - memory_id (string): ID of the memory to validate\n" +
      "  - state: 'validated', 'invalidated', or 'untested'\n\n" +
      "Returns: Confirmation.",
    inputSchema: {
      memory_id: z.string().describe("ID of the memory to validate"),
      state: z
        .enum(["validated", "invalidated", "untested"])
        .describe("New validation state"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ memory_id, state }) => {
    try {
      await validateMemory(memory_id, state);
      return {
        content: [
          {
            type: "text" as const,
            text: `Memory ${memory_id} marked as ${state}.`,
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Validation failed: ${msg}` }],
      };
    }
  }
);

/**
 * Get the active trajectory — the navigational model synthesized from memories.
 * Returns the compressed injection block, same format the Chrome extension uses.
 */
server.registerTool(
  "hearth_get_trajectory",
  {
    title: "Get Active Trajectory",
    description:
      "Retrieves the active trajectory — a navigational model synthesized from " +
      "accumulated memories. Not who the user IS, but where they're GOING.\n\n" +
      "The trajectory has three sections:\n" +
      "  - ARCS: what's in motion, which direction\n" +
      "  - TENSIONS: competing goals to hold simultaneously\n" +
      "  - DRIFT: what's being avoided, deferred, or losing energy\n\n" +
      "Returns the compressed version (~90 tokens) formatted as a [TRAJECTORY] block.\n" +
      "If no trajectory exists, returns instructions to synthesize one.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const userId = process.env.HEARTH_USER_ID;
      if (!userId) throw new Error("HEARTH_USER_ID environment variable is required");
      const trajectory = await getActiveTrajectory(userId);

      if (!trajectory) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No trajectory synthesized yet. Run trajectory synthesis from the Chrome extension first.",
            },
          ],
        };
      }

      const genDate = trajectory.generated_at
        ? new Date(trajectory.generated_at).toISOString().split("T")[0]
        : "unknown";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `[TRAJECTORY]\n` +
              `Generated: ${genDate} | ${trajectory.memory_count} memories\n\n` +
              `${trajectory.compressed}\n` +
              `[/TRAJECTORY]`,
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          { type: "text" as const, text: `Failed to get trajectory: ${msg}` },
        ],
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Transport setup — stdio for local, HTTP for hosted
// ---------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hearth MCP server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "hearth-mcp-server", version: "1.0.0" });
  });

  // MCP endpoint
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3001");
  app.listen(port, () => {
    console.error(`Hearth MCP server running on http://localhost:${port}/mcp`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
