# Forge Dynamic Detection — Integration Guide

## File: `hearth/utils/forgeDetector.js` (NEW)
Copy the forgeDetector.js file into `hearth/utils/forgeDetector.js`.

## File: `hearth/manifest.json`
Add the new script to content_scripts (alongside affectDetector.js):

```json
"content_scripts": [
  {
    "js": [
      "utils/affectDetector.js",
      "utils/forgeDetector.js",   // ← ADD THIS
      "content/injector.js",
      "content/fetch-interceptor.js"
    ]
  }
]
```

---

## File: `hearth/content/fetch-interceptor.js`

### Change 1: Replace manual Forge complement generation with dynamic detection

The current code likely has a section that reads `forgeMode` from chrome.storage
and generates a static complement block based on the selected phase (DIVERGE/INCUBATE/etc).

**Find the section that looks approximately like this:**
```js
// Something like:
const forgeMode = hearthData.forgeMode || 'OFF';
if (forgeMode !== 'OFF') {
  const forgeBlock = generateForgeBlock(forgeMode); // or similar
  // ... injects forgeBlock into system prompt
}
```

**Replace with:**
```js
const forgeEnabled = hearthData.forgeEnabled !== false; // Default ON
const forgeAutoDetect = hearthData.forgeAutoDetect !== false; // Default ON

if (forgeEnabled) {
  let forgeComplement;

  if (forgeAutoDetect && window.ForgeDetector) {
    // DYNAMIC: Detect phase from conversation messages
    const messages = body.messages || []; // The API payload messages
    const result = window.ForgeDetector.getForgeComplement(messages);
    forgeComplement = result.complement;

    // Optional: Log for debugging (remove in production)
    console.log('[Hearth/Forge] Detected:', result.phase, result.shape);
  } else {
    // MANUAL FALLBACK: Use the popup-selected mode
    const forgeMode = hearthData.forgeMode || 'OFF';
    if (forgeMode !== 'OFF') {
      forgeComplement = generateForgeBlock(forgeMode); // Keep existing function
    }
  }

  if (forgeComplement) {
    // Inject into system prompt (same injection point as before)
    // The complement text already includes [FORGE COMPLEMENT]...[END FORGE COMPLEMENT] tags
    hearthBlock += '\n\n' + forgeComplement;
  }
}
```

### Change 2: Pass affect shape to Forge for cross-system awareness

If the affect complement is generated before Forge, you can pass the affect shape
to inform the Forge complement. This is optional but enables future cross-modulation:

```js
// After affect detection
const affectShape = window.AffectDetector
  ? window.AffectDetector.detect(lastUserMessage)
  : { expansion: 0, activation: 0, certainty: 0 };

// When generating Forge complement, you could adjust:
// e.g., if activation is very high, bias openness toward diverge
// (This is a FUTURE enhancement — skip for v1)
```

---

## File: `hearth/popup/popup.js`

### Change: Add auto-detect toggle, keep manual as fallback

**Add a new toggle in the Forge section of the popup:**
```html
<div class="forge-controls">
  <label class="toggle-label">
    <input type="checkbox" id="forge-enabled" checked />
    Forge
  </label>
  <label class="toggle-label" id="forge-auto-label">
    <input type="checkbox" id="forge-auto-detect" checked />
    Auto-detect phase
  </label>
  <!-- Existing manual phase buttons — show only when auto-detect is OFF -->
  <div id="forge-manual-controls" style="display: none;">
    <!-- existing DIVERGE / INCUBATE / CONVERGE / REFINE buttons -->
  </div>
</div>
```

**Add the JS handler:**
```js
document.getElementById('forge-auto-detect').addEventListener('change', (e) => {
  const autoDetect = e.target.checked;
  chrome.storage.local.set({ forgeAutoDetect: autoDetect });

  // Show/hide manual controls
  document.getElementById('forge-manual-controls').style.display =
    autoDetect ? 'none' : 'block';
});

document.getElementById('forge-enabled').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ forgeEnabled: enabled });

  // Hide all forge controls if disabled
  document.getElementById('forge-auto-label').style.display =
    enabled ? 'inline-flex' : 'none';
  document.getElementById('forge-manual-controls').style.display =
    enabled && !document.getElementById('forge-auto-detect').checked ? 'block' : 'none';
});
```

---

## File: `hearth/content/injector.js`

### Change: Add forgeAutoDetect to the data retrieved from storage

**Find the chrome.storage.local.get call and add the new keys:**
```js
chrome.storage.local.get([
  'hearthEnabled',
  'affectEnabled',
  'forgeEnabled',       // ← ADD
  'forgeAutoDetect',    // ← ADD
  'forgeMode',          // Keep for manual fallback
  // ... other existing keys
], (data) => {
  // ... pass to fetch-interceptor as before
});
```

---

## Testing

### Quick smoke test in browser console:
```js
// Test the detector directly
const testMessages = [
  "What if we used a sliding window? Or maybe a decay function?",
  "Actually, what about something completely different — event-driven instead of polling?",
  "Or we could combine them... hmm, there might be a third option"
];

const result = window.ForgeDetector.getForgeComplement(
  testMessages.map(m => ({ role: 'user', content: m }))
);

console.log(result.shape);      // Should be: openness > 0.3 (diverging)
console.log(result.phase);      // Should be: DIVERGE
console.log(result.complement); // Should include "expand the space" instructions
```

### Phase transition test:
```js
// Simulate diverge → converge transition
const transitionMessages = [
  "What if we tried X? Or Y? Maybe Z?",
  "Actually, I keep coming back to X",
  "Yeah, X is it. Let's build X.",
  "The first step for X is...",
  "Here's how the implementation should work:"
];

const result = window.ForgeDetector.getForgeComplement(
  transitionMessages.map(m => ({ role: 'user', content: m }))
);

console.log(result.shape);  // Should be: openness < -0.2, materiality > 0 (converging + material)
console.log(result.phase);  // Should be: CONVERGE
```

---

## Architecture Notes

### Why this mirrors affectDetector.js:
- affectDetector: single message → 3 axes → affect complement text
- forgeDetector: message window → 2 axes → forge complement text
- Both produce `[COMPLEMENT]...[END COMPLEMENT]` blocks
- Both inject into the same system prompt pipeline
- Both use continuous values, not discrete categories

### The sliding window is the key differentiator:
- Affect reads the CURRENT message (emotional state is immediate)
- Forge reads the TRAJECTORY (creative phase emerges over multiple messages)
- This is why Forge needs `messages[]` not `message` as input

### Future: Affect × Forge cross-modulation
The two systems can inform each other:
- High activation + high openness = manic divergence (might need dampening)
- Low activation + low materiality = stuck incubation (might need a nudge)
- High certainty + converging = user is confident and building (match energy)
- Low certainty + refining = user is polishing but unsure (be the mirror)

This is v2 territory. Get the axes working independently first.
