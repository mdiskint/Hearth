# 🔥 Hearth - Personalized AI Context Injection

**What Kind of Human Are You?**

Hearth is a Chrome extension that makes AI adapt to *you*, not averages. Answer 15 quick questions and Hearth builds an Operating Specification (OpSpec) that reshapes how ChatGPT, Claude, and Gemini respond to you.

## 🎯 What It Does

- **Personality Quiz**: 15 questions that feel like a fun personality test
- **OpSpec Generation**: Automatically generates your personalized Operating Specification
- **Context Injection**: Prepends your OpSpec to every message you send
- **Multi-Platform**: Works across ChatGPT, Claude, and Gemini
- **Privacy-First**: Everything stored locally in your browser

## 📦 Phase 1 Features

✅ 15-question personality quiz  
✅ OpSpec generation from quiz answers  
✅ Context injection (prepends OpSpec to messages)  
✅ Multi-platform support (ChatGPT, Claude, Gemini)  
✅ Dashboard with enable/disable toggle  
✅ Retake quiz anytime  

🚧 Coming in Phase 2:  
- Memory CRUD (create/edit/delete memories)
- Semantic retrieval with embeddings
- Heat-gating for emotional intensity matching
- Memory validation states

## 🚀 Installation

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

## 🎮 How to Use

### Basic Usage

1. Go to ChatGPT, Claude, or Gemini
2. You'll see a small "🔥 Hearth Active" indicator in the bottom right
3. Type your message as normal
4. Hearth automatically prepends your OpSpec before sending
5. The AI responds based on your personalized context

### Managing Your OpSpec

**View/Edit:**
- Click the Hearth icon → Dashboard
- See your OpSpec summary
- Click "View/Edit OpSpec" to see the full version

**Retake Quiz:**
- Click the Hearth icon → Dashboard
- Scroll down and click "Retake personality quiz"
- Your new answers will generate a fresh OpSpec

**Disable/Enable:**
- Click the Hearth icon → Dashboard
- Toggle "Enable context injection" on/off

### Settings

**Enable context injection**: Turn Hearth on/off globally

**Show injected context**: When enabled, you'll see the OpSpec prepended to your message (useful for debugging)

## 🧪 Testing

### Test the Quiz

1. Click Hearth icon
2. Go through the quiz
3. Try different answer combinations
4. Check that the generated OpSpec makes sense

### Test Injection

1. Go to claude.ai
2. Open DevTools (F12) → Console
3. Type a message in Claude
4. Look for `Hearth: OpSpec injected` in console
5. Check that your message now includes `[HEARTH CONTEXT]` at the top

### Test Multi-Select Questions

- Q3, Q4, Q5, Q6, Q10, Q11, Q12, Q15 allow multiple selections
- Try selecting multiple options
- Verify they all save correctly

### Test Result Screen

- Complete the quiz
- Check that the personality archetype displays
- Check that highlights show correctly
- Toggle "See Full Operating Specification"
- Verify all sections render properly

## 🏗️ Project Structure

```
hearth/
├── manifest.json           # Extension config
├── background.js           # Background service worker
├── popup/
│   ├── popup.html         # Quiz UI
│   ├── popup.css          # Styling
│   └── popup.js           # Quiz logic
├── content/
│   ├── content.js         # Main content script
│   └── injector.js        # OpSpec injection logic
├── utils/
│   ├── platforms.js       # Platform detection
│   ├── quiz-questions.js  # 15 questions
│   └── opspec-generator.js # Answer → OpSpec conversion
├── storage/
│   └── storage.js         # LocalStorage wrapper
└── icons/
    └── (placeholder)      # Need to add actual icons
```

## 🐛 Known Issues & Limitations

### Icons
- Currently using placeholders
- Chrome will show default icon until you add PNG files
- See `icons/icon-placeholder.txt` for instructions

### Platform Detection
- Selectors may break if ChatGPT/Claude/Gemini update their UI
- If injection stops working, check console for errors
- Selectors are in `utils/platforms.js`

### Injection Timing
- Currently injects on button click or Enter key
- May occasionally miss if platform handles submission differently
- Refresh the page if injection seems stuck

## 🔧 Development

### Debugging

**Content Script:**
- Open DevTools on ChatGPT/Claude/Gemini
- Check Console for `Hearth:` logs
- Verify OpSpec injection is happening

**Popup:**
- Right-click Hearth icon → Inspect popup
- DevTools will open for the popup
- Debug quiz logic, storage, etc.

**Background Script:**
- Go to `chrome://extensions/`
- Click "Inspect views: background page"
- Debug background worker

### Common Issues

**Quiz not saving:**
- Check DevTools → Application → Storage → Local Storage
- Verify `chrome.storage.local` has your data

**Injection not working:**
- Check if platform was detected: Look for `Hearth: Detected [Platform]` in console
- Verify input field selector is correct
- Try typing a message and hitting Enter

**OpSpec not generating:**
- Check all 15 questions were answered
- Open popup DevTools and check for errors
- Verify `opspec-generator.js` is loaded

## 📝 Next Steps (Phase 2)

1. **Memory System**
   - Add memory CRUD UI
   - Implement storage for user memories
   - Build memory list/edit interface

2. **Semantic Retrieval**
   - Add embedding generation
   - Implement cosine similarity search
   - Build retrieval scoring system

3. **Heat-Gating**
   - Add heat calculation logic
   - Implement intensity matching
   - Build heat-based retrieval filters

4. **Validation States**
   - Add validation UI
   - Track memory confidence
   - Implement validation lifecycle

## 🎨 Design Philosophy

**The quiz should feel fun, not clinical.**
- Personality test energy, not therapy intake
- Clear visual design with emojis
- Fast, engaging flow

**The OpSpec should feel personal.**
- Generated prose, not form fields
- Reflects actual preferences
- Readable and auditable

**Injection should be invisible (or visible for debugging).**
- Seamless integration with platforms
- No UI disruption
- Easy to toggle on/off

## 📄 License

MIT - Built by Michael Diskint as part of Hearth AI research

---

**Questions or issues?** Check the console logs, inspect storage, or retake the quiz to regenerate your OpSpec.

**Ready to build Phase 2?** The memory system awaits!
