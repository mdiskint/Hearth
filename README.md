# 🔥 Hearth - AI Personalization Through Behavioral Patterns

**Personalization IS Alignment**

Most AI systems try to align to an "average human" - a statistical fiction that represents no actual person. Hearth takes a different approach: it learns how *you* think, extracts behavioral patterns from your interactions, and makes AI adapt to your cognitive operating system.

## What It Does

Hearth is a Chrome extension that learns how you think by watching you work, then makes ChatGPT, Claude, and Gemini adapt to your cognitive operating system:

- **Operating Specification**: 15-question quiz generates your initial cognitive profile
- **Automatic Memory Extraction**: Learns from your conversations in real-time as you use AI
- **Import Past Conversations**: Bring your history from Claude, ChatGPT, or other platforms
- **Manual Memory Curation**: Add, edit, or refine specific facts, values, and patterns
- **Context Injection**: Automatically prepends your OpSpec and relevant memories to every message
- **Multi-Platform**: Works across ChatGPT, Claude, and Gemini
- **Privacy-First**: Everything stored locally in your browser

## Current Features

✅ Personality quiz that generates your Operating Specification  
✅ **Automatic memory extraction** - learns from your conversations as you chat  
✅ **Import conversations** from Claude, ChatGPT, Gemini, or other AI platforms  
✅ Manual memory creation, editing, and deletion  
✅ Memory organization by type (fact/value/pattern)  
✅ Tagging by life domain (Work, Creative, Self, etc.)  
✅ Tagging by emotional state (Joy, Anxiety, Curiosity, etc.)  
✅ Automatic context injection across platforms  
✅ Dashboard with enable/disable toggle  

## Installation

### 1. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `hearth` folder
5. The Hearth extension should now appear in your extensions list

### 2. Pin the Extension

1. Click the puzzle piece icon in Chrome toolbar
2. Find Hearth and click the pin icon
3. The Hearth icon will now appear in your toolbar

### 3. Take the Quiz

1. Click the Hearth icon
2. Click "Let's go" to start the quiz
3. Answer 15 questions (takes ~3 minutes)
4. Review your generated OpSpec
5. Click "Let's go!" to activate

## How to Use

### Basic Usage

1. Go to ChatGPT, Claude, or Gemini
2. You'll see a small "🔥 Hearth Active" indicator
3. Type your message as normal
4. Hearth automatically:
   - Extracts facts, values, and patterns from the conversation
   - Prepends your OpSpec and relevant memories to your message
   - Learns how you think and work over time
5. The AI responds based on your personalized context

**You don't need to do anything special.** Just use AI normally. Hearth watches your conversations and builds your memory bank automatically. The more you use it, the better it understands your cognitive patterns.

### How Memories Work

Hearth builds your memory bank through three channels:

**1. Automatic Extraction (Recommended)**

As you use ChatGPT, Claude, or Gemini with Hearth enabled, the system automatically extracts:
- Facts about you and your context
- Values and preferences you express
- Behavioral patterns in how you work and think

This happens in the background. Just use AI normally and Hearth learns from your interactions.

**2. Import Conversations**

Already have conversation history with Claude, ChatGPT, or other AI platforms?
1. Click Hearth icon → Dashboard
2. Click "Import Conversations"
3. Upload your chat history (supports Claude exports, ChatGPT JSON, plain text)
4. Hearth extracts memories from past conversations

**3. Manual Curation**

Want to add something specific or refine what Hearth extracted?
1. Click Hearth icon → Dashboard
2. Click "Add Memory"
3. Choose memory type:
   - **Fact**: Concrete information ("I'm a law student")
   - **Value**: What matters to you ("I prefer direct feedback")
   - **Pattern**: How you think/behave ("When stuck, I build rather than plan")
4. Tag with life domain and emotional state (optional)
5. Save

You can edit or delete any memory (automatic or manual) from the dashboard.

### Managing Your OpSpec

**View/Edit:**
- Click Hearth icon → Dashboard
- See your OpSpec summary
- Click "View/Edit OpSpec" for full version

**Retake Quiz:**
- Dashboard → "Retake personality quiz"
- New answers generate fresh OpSpec

**Disable/Enable:**
- Toggle "Enable context injection" in Dashboard

## How It Works

Hearth's architecture is built on a simple insight: most AI memory systems organize around *what* you talked about (topics, entities, preferences). Hearth organizes around *how* you operate.

**Memory Extraction**

As you interact with Claude, ChatGPT, or Gemini, Hearth continuously extracts:
- **Facts**: Concrete details about your context and situation
- **Values**: What you care about, what matters in decisions
- **Patterns**: How you approach problems, build momentum, or recover from stuckness

You can also import past conversations or manually add memories, but the automatic extraction is what makes the system learn your actual cognitive patterns over time.

**The Three-Layer System:**

**The Hearth** retrieves your memories using semantic similarity and generates a baseline response - the kind of answer that would work for most people. This is the reference point.

**The Scout** analyzes retrieved memories for behavioral invariants - patterns in how you process uncertainty, build momentum, recover from stuckness, or make decisions. When memories about apartment hunting and career decisions both appear, most systems see two separate topics. The Scout sees: "In both cases, you spiraled by collecting endless options without narrowing. The noun changed, but the verb stayed the same."

**The Judge** applies these behavioral patterns to new contexts. If you broke through stuckness on one project by externalizing abstraction into spatial form, the Judge might suggest: "This feels stuck - what if you made it spatial instead of staying in writing mode?"

The Scout's pattern recognition is probabilistic - it surfaces confidence levels (high/medium/low) and adjusts suggestions accordingly. High confidence means proven leverage. Low confidence means speculative synthesis. Both have value.

**Current Implementation:** The OpSpec, automatic memory extraction, and memory injection system are fully functional. The Scout architecture is the theoretical framework guiding development of semantic retrieval and behavioral pattern extraction (coming in future updates).

## What's Next

**Semantic Retrieval**
- Generate embeddings for each memory
- Only inject most relevant memories based on query
- Reduce token bloat, improve signal

**Heat-Gating**
- Match memory depth to conversation intensity
- High-stakes memories surface in high-stakes moments
- Light memories stay light

**Behavioral Pattern Extraction**
- Automatic detection of action invariants
- Cross-domain pattern application
- Confidence-calibrated suggestions

**Validation & Trust Scoring**
- Track which memories prove useful
- Prioritize validated patterns
- Learn what works for you over time

## Project Structure

```
hearth/
├── manifest.json           # Extension config
├── background.js           # Background service worker
├── popup/
│   ├── popup.html         # Dashboard UI
│   ├── popup.css          # Styling
│   └── popup.js           # Quiz & memory logic
├── content/
│   ├── content.js         # Main content script
│   └── injector.js        # Context injection
├── utils/
│   ├── platforms.js       # Platform detection
│   ├── quiz-questions.js  # 15 questions
│   └── opspec-generator.js # OpSpec generation
└── storage/
    └── storage.js         # LocalStorage wrapper
```

## Development

### Debugging

**Content Script:**
- Open DevTools on ChatGPT/Claude/Gemini
- Check Console for `Hearth:` logs
- Verify OpSpec injection

**Popup:**
- Right-click Hearth icon → Inspect popup
- Debug quiz logic and memory management

**Background Script:**
- Go to `chrome://extensions/`
- Click "Inspect views: background page"

### Testing Injection

1. Go to claude.ai
2. Open DevTools (F12) → Console
3. Type a message
4. Look for `Hearth: OpSpec injected` in console
5. Verify `[HEARTH CONTEXT]` prepends your message

## Known Issues

**Platform Selectors**
- May break if ChatGPT/Claude/Gemini update their UI
- Check `utils/platforms.js` if injection stops working

**Memory Token Limit**
- All memories currently inject (no smart filtering yet)
- Keep under 20 memories until semantic retrieval ships
- Individual memories capped at 500 characters

**Injection Timing**
- Injects on button click or Enter key
- Refresh page if injection seems stuck

## License

This Chrome extension is open source under the MIT License - use it, modify it, learn from it.

The underlying personalization architecture and methods described in this README (Scout/Hearth/Judge system, behavioral pattern extraction, cross-domain application of action invariants) are proprietary and subject to pending intellectual property protections.

Built by Michael Diskint as part of Hearth AI research.

---

**The Core Thesis:** You can't align AI to an "average human" because no individual represents that statistical mean. Personalization isn't a feature layer - it's the fundamental unit of alignment. Hearth is an experiment in what happens when you take that seriously.
