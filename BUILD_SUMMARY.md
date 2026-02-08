# HEARTH - BUILD SUMMARY

## What We Built

**Hearth** - A Chrome extension for personalized AI context injection

### Completed Features

**1. Personality Quiz & OpSpec Generation**
- 15-question personality quiz
- Mix of single-choice and multi-select questions
- Progress tracking and navigation
- Generates structured Operating Specification
- Personality archetype detection

**2. Context Injection**
- Platform detection (ChatGPT, Claude, Gemini)
- Fetch interception for seamless injection
- OpSpec prepended to prompts
- Enable/disable toggle
- Debug mode to show injected context

**3. Storage & Settings**
- Chrome local storage for OpSpec and settings

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
│   └── popup.js              # Quiz, dashboard logic
```

### Content Scripts (Injection)
```
├── content/
│   ├── content.js            # Main entry point
│   ├── injector.js           # Data injection to page context
│   └── fetch-interceptor.js  # Fetch interception + OpSpec injection
```

### Utilities
```
├── utils/
│   ├── platforms.js          # Platform detection
│   ├── chatParser.js         # Conversation export parsing
│   └── modelRouter.js        # Model routing utilities
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
User Message → Build Context → Inject
```
## How It Works

### First-Time Setup

1. User installs extension
2. Takes 15-question personality quiz
3. OpSpec generated from answers
4. Dashboard appears

### Ongoing Usage

1. User goes to ChatGPT/Claude/Gemini
2. Types a message
3. Hearth prepends OpSpec context
4. AI responds with personalized context

## Testing

### Load Extension
```
chrome://extensions/ → Developer mode → Load unpacked → Select hearth folder
```

### Test Quiz
- Click Hearth icon
- Complete 15 questions
- Verify OpSpec generation

### Test Injection
1. Go to claude.ai
2. Open DevTools → Console
3. Send any message
4. Verify `[HEARTH CONTEXT]` is prepended in the request payload

## Design Decisions

**Why fetch interception?**
- Works regardless of UI changes
- Intercepts at API level
- More reliable than DOM manipulation

---

## Stats

- **~2,500 lines** of JavaScript
- **~400 lines** of CSS
- **~250 lines** of HTML
- **3** platforms supported

---

## The Core Thesis

You can't align AI to an "average human" because no individual represents that statistical mean. Personalization isn't a feature layer - it's the fundamental unit of alignment.

Hearth organizes around *how* you operate, not *what* you talk about.

**This is what happens when you take personalization seriously.**
