# Hearth - AI Personalization Through Behavioral Patterns

**Personalization IS Alignment**

Most AI systems try to align to an "average human" - a statistical fiction that represents no actual person. Hearth takes a different approach: it learns how *you* think, extracts behavioral patterns from your interactions, and makes AI adapt to your cognitive operating system.

## What It Does

Hearth is a Chrome extension that intercepts your messages to ChatGPT, Claude, and Gemini, then prepends personalized context based on your cognitive profile:

- **Operating Specification**: 15-question quiz generates your initial cognitive profile
- **Prompt Interception**: Prepends your OpSpec to requests in supported platforms
- **Multi-Platform**: Works across ChatGPT, Claude, and Gemini
- **Privacy-First**: Everything stored locally in your browser

## Current Features

**Core System**
- Personality quiz generating your Operating Specification
- OpSpec injection into supported platform prompts
- Settings toggles for injection and visibility

## Architecture

```
User Message → Build Context → Inject
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

## How to Use

### Basic Usage

1. Go to ChatGPT, Claude, or Gemini
2. Type your message as normal
3. Hearth automatically:
   - Prepends your OpSpec
4. The AI responds based on your personalized context

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
│   └── popup.js              # Quiz & dashboard logic
├── content/
│   ├── content.js            # Main content script
│   ├── injector.js           # Data injection to page context
│   └── fetch-interceptor.js  # Fetch interception + OpSpec injection
├── utils/
│   ├── platforms.js          # Platform detection
│   ├── chatParser.js         # Conversation export parsing
│   └── modelRouter.js        # Model routing utilities
└── storage/
    └── storage.js            # Chrome storage wrapper
```

## Development

### Debugging

**Console Logs:**
- Open DevTools on ChatGPT/Claude/Gemini
- Filter by `Hearth:` to see injection logs

**Popup:**
- Right-click Hearth icon → Inspect popup
- Debug quiz logic and OpSpec editing

**Background Script:**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"

### Testing Injection

1. Go to claude.ai
2. Open DevTools (F12) → Console
3. Send any message
4. Verify the `[HEARTH CONTEXT]` block is prepended in the request payload

## What's Next

**Cross-Platform Import**
- ChatGPT export support
- Gemini export support
- Plain text conversation parsing

## Known Issues

**Platform Selectors**
- May break if ChatGPT/Claude/Gemini update their UI
- Check `utils/platforms.js` if injection stops working

**API Keys Required**
- None for core OpSpec injection

## License

This Chrome extension is open source under the MIT License - use it, modify it, learn from it.

The underlying personalization architecture and methods described in this README (Scout/Hearth/Judge system, behavioral pattern extraction, cross-domain application of action invariants) are proprietary and subject to pending intellectual property protections.

Built by Michael Diskint as part of Hearth AI research.

---

**The Core Thesis:** You can't align AI to an "average human" because no individual represents that statistical mean. Personalization isn't a feature layer - it's the fundamental unit of alignment. Hearth is an experiment in what happens when you take that seriously.
