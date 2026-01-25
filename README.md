# Hearth - AI Personalization Through Behavioral Patterns

**Personalization IS Alignment**

Most AI systems try to align to an "average human" - a statistical fiction that represents no actual person. Hearth takes a different approach: it learns how *you* think, extracts behavioral patterns from your interactions, and makes AI adapt to your cognitive operating system.

## What It Does

Hearth is a Chrome extension that intercepts your messages to ChatGPT, Claude, and Gemini, then prepends personalized context based on your cognitive profile and behavioral patterns:

- **Operating Specification**: 15-question quiz generates your initial cognitive profile
- **Memory Extraction**: Import past conversations from Claude to extract facts, values, and patterns
- **Semantic Retrieval**: Only injects memories relevant to your current query
- **Heat-Gated Filtering**: Matches memory depth to conversation intensity
- **Scout Analysis**: Detects behavioral verb patterns across your memories
- **Multi-Platform**: Works across ChatGPT, Claude, and Gemini
- **Privacy-First**: Everything stored locally in your browser

## Current Features

**Core System**
- Personality quiz generating your Operating Specification
- Import conversations from Claude exports (Anthropic API required)
- Manual memory creation, editing, and deletion
- Memory organization by type (fact/value/reward/synthesis/partner_model/self_model)
- Tagging by life domain (Work, Relationships, Creative, Self, Decisions, Resources, Values)
- Tagging by emotional state (Joy, Curiosity, Pride, Peace, Grief, Fear, Anxiety, Shame, Anger, Care)

**Intelligent Retrieval**
- Heat detection classifies query intensity (HOT/WARM/COOL/COLD)
- Temporal filtering based on heat level (hot queries access all memories, cold queries skip memories)
- Semantic retrieval via OpenAI embeddings (text-embedding-3-small)
- Cosine similarity with 0.55 threshold filtering
- Top 15 most relevant memories injected per query

**Scout Pattern Analysis**
- Detects 8 behavioral verb patterns in your memories
- Evidence-based confidence calibration with time decay
- Contradiction detection downgrades stale patterns
- DORMANT patterns (insufficient evidence) are not surfaced
- Query-relevance matching via pattern bridges

## Architecture

```
User Message → Heat Detection → Temporal Filter → Semantic Retrieval → Scout Analysis → Build Context → Inject
```

**The Three-Layer System:**

**The Hearth** generates the baseline - retrieving memories using semantic similarity and heat-gating. This provides the reference point against which personalization is measured.

**The Scout** analyzes retrieved memories for behavioral invariants - patterns in *how* you do things, not *what* you've done. When memories about apartment hunting and career decisions both appear, most systems see two topics. The Scout sees: "In both cases, you spiraled by collecting endless options. The noun changed, but the verb stayed the same."

**The Judge** (the AI receiving context) applies these patterns to generate responses calibrated to your cognitive operating system. High confidence patterns get applied directly. Low confidence patterns get surfaced as options.

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

### Heat Classification

| Level | Score | Time Window | Example Triggers |
|-------|-------|-------------|------------------|
| HOT | 0.6-1.0 | All time | crisis, panic, overwhelming, hopeless |
| WARM | 0.3-0.6 | 90 days | should I, career change, relationship, struggling |
| COOL | 0.1-0.3 | 30 days | how do I, explain, help me understand |
| COLD | 0.0-0.1 | None (skip) | hi, thanks, ok, testing |

### Confidence Calibration

Confidence is a revocable license. Patterns must be re-validated by recent evidence to maintain high confidence, and counter-evidence actively downgrades confidence.

**Recency Decay:**
| Age | Weight | Effect |
|-----|--------|--------|
| <30 days | 1.0x | Full credit |
| 30-90 days | 0.5x | Half credit |
| >90 days | 0.25x | Quarter credit |

**Contradiction Handling:**
- Contradictions detected via pattern-specific bridges (e.g., "decided quickly" contradicts `decision_spiral`)
- Contradiction strength: weak (1.5x penalty), normal (1.75x), strong (2.0x)
- Recent strong contradictions cap confidence at MEDIUM
- 3+ recent strong supports can override the cap

**Confidence Levels:**
| Level | Score Threshold | Behavior |
|-------|-----------------|----------|
| HIGH | ≥0.70 | Pattern applied directly |
| MEDIUM | ≥0.40 | Pattern offered as option |
| LOW | ≥0.20 | Pattern noted speculatively |
| DORMANT | <0.10 | Pattern not surfaced |

**Key Rules:**
- 120+ days without recent support: max MEDIUM (decayed)
- Recent strong contradiction: max MEDIUM (unless overridden)
- DORMANT patterns are never injected into context

**Scout Output Example:**
```
[HIGH] spirals via option-accumulation
  Observed across: Work, Decisions
  Evidence: 4 instances
  Intervention: needs constraint to decide
  Last seen: 2025-01-20
  Supports: 3 recent / 4 total
  Rationale: Strong evidence (4 supports, 2 domains)
```

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

### 4. API Keys

**For memory extraction (import):**
- Requires Anthropic API key
- Prompted on first import, then saved locally

**For semantic retrieval:**
- Requires OpenAI API key (for embeddings)
- Set via extension settings or storage

## How to Use

### Basic Usage

1. Go to ChatGPT, Claude, or Gemini
2. Type your message as normal
3. Hearth automatically:
   - Detects query heat level
   - Retrieves semantically relevant memories
   - Runs Scout analysis for behavioral patterns
   - Prepends your OpSpec, memories, and Scout insights
4. The AI responds based on your personalized context

Check the browser console for logs:
- `Hearth: Query heat detected: 0.45 (WARM)`
- `Hearth: Semantic retrieval found 8 relevant memories`
- `Hearth: Scout analysis found 2 patterns: HIGH spirals via option-accumulation, MEDIUM externalizes to clarify`

### Importing Memories

1. Export your conversations from Claude (Settings → Export Data)
2. Click Hearth icon → Dashboard
3. Click "Import Memories"
4. Select your exported `.json` file
5. Enter Anthropic API key when prompted (first time only)
6. Memories are extracted and saved automatically

### Manual Memory Curation

1. Click Hearth icon → Dashboard
2. Click "Add Memory"
3. Choose memory type:
   - **Fact**: Concrete information ("I'm a law student")
   - **Value**: What matters to you ("I prefer direct feedback")
   - **Reward**: Feedback on past interactions
   - **Synthesis**: Patterns/insights about yourself
   - **Partner Model**: How you want AI to behave
   - **Self Model**: How you see yourself
4. Set heat level (0.0-1.0) for importance
5. Tag with life domain and emotional state (optional)
6. Save

### Managing Your OpSpec

**View/Edit:**
- Click Hearth icon → Dashboard
- Click "View/Edit OpSpec" for full version

**Retake Quiz:**
- Dashboard → "Retake personality quiz"

**Disable/Enable:**
- Toggle "Enable context injection" in Dashboard

## Project Structure

```
hearth/
├── manifest.json              # Extension config
├── background.js              # Background service worker
├── popup/
│   ├── popup.html            # Dashboard UI
│   ├── popup.css             # Styling
│   └── popup.js              # Quiz & memory logic
├── content/
│   ├── content.js            # Main content script
│   ├── injector.js           # Data injection to page context
│   └── fetch-interceptor.js  # Fetch interception, heat detection, Scout
├── content-script/
│   └── conversationMonitor.js # Live extraction (disabled)
├── utils/
│   ├── platforms.js          # Platform detection
│   ├── embeddings.js         # OpenAI embedding generation
│   ├── memoryExtractor.js    # Claude-based memory extraction
│   ├── chatParser.js         # Conversation export parsing
│   ├── supabaseSync.js       # Optional cloud sync
│   └── scout/
│       ├── behavioralVerbs.js   # 8 pattern definitions + contradiction bridges
│       ├── confidenceConfig.js  # Decay/contradiction thresholds
│       ├── confidenceScorer.js  # Evidence-based confidence calculation
│       ├── evidenceStore.js     # PatternEvidence persistence
│       ├── scoutAnalyzer.js     # Main Scout logic
│       └── index.js             # Module exports
├── tests/
│   └── scout-confidence.test.js # Confidence calibration tests
└── storage/
    └── storage.js            # Chrome storage wrapper
```

## Development

### Debugging

**Console Logs:**
- Open DevTools on ChatGPT/Claude/Gemini
- Filter by `Hearth:` to see all logs
- Key logs: heat detection, memory retrieval, Scout analysis

**Popup:**
- Right-click Hearth icon → Inspect popup
- Debug quiz logic and memory management

**Background Script:**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"

### Testing Injection

1. Go to claude.ai
2. Open DevTools (F12) → Console
3. Send a message like "I'm stuck on which job to take"
4. Look for:
   - `Hearth: Query heat detected: X.XX (WARM)`
   - `Hearth: Semantic retrieval found X relevant memories`
   - `Hearth: Scout analysis found X patterns`
5. Verify `[HEARTH CONTEXT]` block includes `SCOUT ANALYSIS` section

## What's Next

**Validation & Trust Scoring**
- Track which memories prove useful over time
- Prioritize validated patterns
- Decay unused memories

**Live Extraction**
- Real-time memory extraction during conversations
- Currently implemented but disabled
- Requires conversation monitor activation

**Cross-Platform Import**
- ChatGPT export support
- Gemini export support
- Plain text conversation parsing

## Known Issues

**Platform Selectors**
- May break if ChatGPT/Claude/Gemini update their UI
- Check `utils/platforms.js` if injection stops working

**API Keys Required**
- Anthropic key for memory extraction (import)
- OpenAI key for semantic retrieval (embeddings)
- Without OpenAI key, falls back to heat-based sorting

**Memory Limits**
- Individual memories capped at 500 characters
- Top 15 memories injected per query
- Scout returns top 3 patterns max

## License

This Chrome extension is open source under the MIT License - use it, modify it, learn from it.

The underlying personalization architecture and methods described in this README (Scout/Hearth/Judge system, behavioral pattern extraction, cross-domain application of action invariants) are proprietary and subject to pending intellectual property protections.

Built by Michael Diskint as part of Hearth AI research.

---

**The Core Thesis:** You can't align AI to an "average human" because no individual represents that statistical mean. Personalization isn't a feature layer - it's the fundamental unit of alignment. Hearth is an experiment in what happens when you take that seriously.
