# HEARTH - BUILD SUMMARY

## What We Built

**Hearth** - A Chrome extension for personalized AI context injection with behavioral pattern detection

### Completed Features

**1. Personality Quiz & OpSpec Generation**
- 15-question personality quiz
- Mix of single-choice and multi-select questions
- Progress tracking and navigation
- Generates structured Operating Specification
- Personality archetype detection

**2. Memory System**
- Import conversations from Claude exports
- Claude API-based memory extraction
- Manual memory creation/editing/deletion
- 6 memory types: fact, value, reward, synthesis, partner_model, self_model
- 7 life domains: Work, Relationships, Creative, Self, Decisions, Resources, Values
- 10 emotional states: Joy, Curiosity, Pride, Peace, Grief, Fear, Anxiety, Shame, Anger, Care
- Heat scoring (0.0-1.0) for importance

**3. Intelligent Retrieval Pipeline**
- Heat detection classifies query intensity (HOT/WARM/COOL/COLD)
- Temporal filtering based on heat level
- Semantic retrieval via OpenAI embeddings (text-embedding-3-small)
- Cosine similarity with 0.55 threshold
- Top 15 most relevant memories per query

**4. Scout Pattern Analysis**
- 8 behavioral verb patterns detected
- Confidence scoring (HIGH/MEDIUM/LOW)
- Cross-domain evidence tracking
- Recency weighting
- Query-relevance matching via pattern bridges
- Intervention suggestions

**5. Context Injection**
- Platform detection (ChatGPT, Claude, Gemini)
- Fetch interception for seamless injection
- OpSpec + memories + Scout analysis prepended
- Enable/disable toggle
- Debug mode to show injected context

**6. Storage & Sync**
- Chrome local storage
- Optional Supabase cloud sync
- Memory deduplication on import
- Embedding generation and storage

---

## File Structure

### Core Files
```
hearth/
├── manifest.json              # Chrome extension configuration (MV3)
├── background.js              # Service worker, initialization
├── README.md                  # Complete documentation
├── BUILD_SUMMARY.md           # This file
```

### Popup (Dashboard Interface)
```
├── popup/
│   ├── popup.html            # UI structure
│   ├── popup.css             # Styling
│   └── popup.js              # Quiz, memories, dashboard logic
```

### Content Scripts (Injection)
```
├── content/
│   ├── content.js            # Main entry point
│   ├── injector.js           # Data injection to page context
│   └── fetch-interceptor.js  # Fetch interception, heat detection, Scout
├── content-script/
│   └── conversationMonitor.js # Live extraction (disabled)
```

### Utilities
```
├── utils/
│   ├── platforms.js          # Platform detection
│   ├── embeddings.js         # OpenAI embedding generation
│   ├── memoryExtractor.js    # Claude-based memory extraction
│   ├── chatParser.js         # Conversation export parsing
│   ├── modelRouter.js        # Model routing utilities
│   ├── supabaseSync.js       # Cloud sync
│   └── scout/
│       ├── behavioralVerbs.js   # 8 pattern definitions
│       ├── confidenceScorer.js  # Confidence calculation
│       ├── scoutAnalyzer.js     # Main Scout logic
│       └── index.js             # Module exports
```

### Storage
```
└── storage/
    └── storage.js            # Chrome storage wrapper
```

---

## Architecture

### The Pipeline

```
User Message → Heat Detection → Temporal Filter → Semantic Retrieval → Scout Analysis → Build Context → Inject
```

### The Three-Layer System

**The Hearth** - Generates the baseline by retrieving memories using semantic similarity and heat-gating. This is the reference point.

**The Scout** - Analyzes retrieved memories for behavioral invariants. Detects patterns in *how* you do things, not *what* you've done. Surfaces confidence levels.

**The Judge** - The AI receiving context. Applies behavioral patterns to generate responses calibrated to your cognitive operating system.

### Heat Classification

| Level | Score | Time Window | Behavior |
|-------|-------|-------------|----------|
| HOT | 0.6-1.0 | All time | Crisis, deep struggles - full memory access |
| WARM | 0.3-0.6 | 90 days | Decisions, changes - medium-term memories |
| COOL | 0.1-0.3 | 30 days | How-to, factual - recent memories only |
| COLD | 0.0-0.1 | None | Greetings, simple - skip memories entirely |

### Behavioral Patterns Detected

| Pattern | Verb | Intervention |
|---------|------|--------------|
| `decision_spiral` | spirals via option-accumulation | needs constraint to decide |
| `momentum_through_building` | builds momentum through making | action over planning |
| `externalization_for_clarity` | externalizes to clarify | make abstract concrete |
| `constraint_as_liberation` | gains momentum through constraint | add artificial limits |
| `avoidance_through_research` | delays through endless preparation | act with incomplete info |
| `recovery_through_isolation` | recovers through isolation | protect recovery time |
| `recovery_through_connection` | recovers through connection | facilitate talking |
| `closure_seeking` | seeks rapid closure | provide clear next steps |

### Confidence Scoring

Score components:
- **Instance count** (0.05-0.35): More memories matching = higher confidence
- **Cross-domain bonus** (0-0.25): Same pattern across different life areas
- **Recency** (0-0.15): Recent instances boost confidence
- **Query relevance** (0-0.25): Pattern matches current query bridges

Levels:
- **HIGH** (≥0.70): Apply pattern directly
- **MEDIUM** (0.40-0.69): Offer as option
- **LOW** (<0.40): Surface as speculation

---

## How It Works

### First-Time Setup

1. User installs extension
2. Takes 15-question personality quiz
3. OpSpec generated from answers
4. Dashboard appears with memory management

### Memory Import

1. User exports conversations from Claude
2. Clicks "Import Memories" in dashboard
3. Enters Anthropic API key (first time only)
4. Claude extracts memories from conversations
5. Embeddings generated via OpenAI
6. Memories saved to local storage

### Ongoing Usage

1. User goes to ChatGPT/Claude/Gemini
2. Types a message
3. Hearth detects query heat level
4. Retrieves semantically relevant memories
5. Scout analyzes for behavioral patterns
6. Context injected into request
7. AI responds with personalized context

### Console Output

```
Hearth: Query heat detected: 0.45 (WARM)
Hearth: Heat WARM (0.45) - temporal gate passed 12/47 memories (last 90 days)
Hearth: 8 memories above 0.55 threshold, top similarity: 0.823
Hearth: Semantic retrieval found 8 relevant memories
Hearth: Scout analysis found 2 patterns: HIGH spirals via option-accumulation, MEDIUM externalizes to clarify
Hearth: Selected 8 memories for injection
Hearth: Injected into Claude request
```

---

## Testing

### Load Extension
```
chrome://extensions/ → Developer mode → Load unpacked → Select hearth folder
```

### Test Quiz
- Click Hearth icon
- Complete 15 questions
- Verify OpSpec generation

### Test Memory Import
- Export conversations from Claude
- Click "Import Memories"
- Enter API key when prompted
- Verify memories appear in dashboard

### Test Injection
1. Go to claude.ai
2. Open DevTools → Console
3. Send: "I'm stuck on which job to take"
4. Look for Hearth logs
5. Verify `[HEARTH CONTEXT]` includes `SCOUT ANALYSIS` section

### Test Heat Gating
- Send "hi" → Should see COLD, no memories
- Send "how do I center a div" → Should see COOL, 30-day window
- Send "I'm struggling with a career decision" → Should see WARM, 90-day window
- Send "I'm in crisis and can't cope" → Should see HOT, all memories

---

## API Keys Required

**Anthropic API Key**
- Used for: Memory extraction during import
- When prompted: First import only, then saved
- Model: claude-opus-4-20250514

**OpenAI API Key**
- Used for: Embedding generation for semantic retrieval
- Model: text-embedding-3-small
- Fallback: Heat-based sorting if no key

---

## Known Issues

**Platform Selectors**
- May break if ChatGPT/Claude/Gemini update UI
- Check `utils/platforms.js` if injection stops

**API Dependencies**
- Import requires Anthropic API key
- Semantic retrieval requires OpenAI API key
- Both cost money per use

**Memory Limits**
- Individual memories capped at 500 characters
- Top 15 memories injected per query
- Scout returns max 3 patterns

**Live Extraction**
- Implemented but disabled
- Set `CONFIG.enabled = true` in conversationMonitor.js to enable

---

## What's Next

**Validation & Trust Scoring**
- Track which memories prove useful
- Prioritize validated patterns
- Decay unused memories

**Live Extraction**
- Enable real-time memory extraction
- Configure API key passing
- Test conversation monitor

**Cross-Platform Import**
- ChatGPT export support
- Gemini export support
- Plain text parsing

---

## Design Decisions

**Why fetch interception?**
- Works regardless of UI changes
- Intercepts at API level
- More reliable than DOM manipulation

**Why inline Scout code?**
- Runs in page context (IIFE)
- Cannot import modules
- Must be self-contained

**Why heat-gating?**
- Prevents irrelevant memory injection
- Matches intensity to stakes
- Reduces token usage

**Why behavioral verbs?**
- Patterns persist across contexts
- "How" more stable than "what"
- Enables cross-domain application

**Why confidence levels?**
- Prevents false certainty
- Calibrates suggestion strength
- Maintains user agency

---

## Stats

- **~2,500 lines** of JavaScript
- **~400 lines** of CSS
- **~250 lines** of HTML
- **8** behavioral patterns
- **4** heat levels
- **6** memory types
- **7** life domains
- **10** emotional states
- **3** platforms supported

---

## The Core Thesis

You can't align AI to an "average human" because no individual represents that statistical mean. Personalization isn't a feature layer - it's the fundamental unit of alignment.

Hearth organizes around *how* you operate, not *what* you talk about. The Scout sees behavioral invariants across contexts. The Judge applies proven patterns to new situations.

**This is what happens when you take personalization seriously.**
