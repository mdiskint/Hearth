// platforms.js - Platform detection and selectors

const PLATFORMS = {
  chatgpt: {
    name: 'ChatGPT',
    detect: () => window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com'),
    selectors: {
      inputArea: 'textarea[data-id="root"]',
      sendButton: 'button[data-testid="send-button"]',
      // Alternative selectors if primary fails
      inputAreaAlt: '#prompt-textarea',
      sendButtonAlt: 'button[aria-label="Send prompt"]'
    }
  },
  
  claude: {
    name: 'Claude',
    detect: () => window.location.hostname.includes('claude.ai'),
    selectors: {
      inputArea: 'div[contenteditable="true"][data-placeholder*="to Claude"]',
      sendButton: 'button[aria-label="Send Message"]',
      // Alternative selectors
      inputAreaAlt: 'div.ProseMirror',
      sendButtonAlt: 'button[type="submit"]'
    }
  },
  
  gemini: {
    name: 'Gemini',
    detect: () => window.location.hostname.includes('gemini.google.com'),
    selectors: {
      // Gemini uses ql-editor contenteditable div
      inputArea: 'div.ql-editor[contenteditable="true"]',
      sendButton: 'button[aria-label*="Send"]',
      // Alternative selectors
      inputAreaAlt: 'div[aria-label="Enter a prompt here"]',
      inputAreaAlt2: 'div.ql-editor.textarea',
      inputAreaAlt3: 'div[data-placeholder*="Gemini"]',
      sendButtonAlt: 'button[mattooltip*="Send"]'
    }
  }
};

function detectPlatform() {
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (platform.detect()) {
      return { id: key, ...platform };
    }
  }
  return null;
}

function findElement(selectors) {
  // Try primary selector
  let element = document.querySelector(selectors.inputArea);

  // Try all alternatives if primary fails
  if (!element && selectors.inputAreaAlt) {
    element = document.querySelector(selectors.inputAreaAlt);
  }
  if (!element && selectors.inputAreaAlt2) {
    element = document.querySelector(selectors.inputAreaAlt2);
  }
  if (!element && selectors.inputAreaAlt3) {
    element = document.querySelector(selectors.inputAreaAlt3);
  }

  return element;
}

function findButton(selectors) {
  // Try primary selector
  let button = document.querySelector(selectors.sendButton);
  
  // Try alternative if primary fails
  if (!button && selectors.sendButtonAlt) {
    button = document.querySelector(selectors.sendButtonAlt);
  }
  
  return button;
}
