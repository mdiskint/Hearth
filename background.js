// background.js - Background service worker
// Note: Supabase sync handled in content script context (storage.js)

console.log('Hearth: Background script loaded');

// Periodic sync - temporarily disabled
// Will re-enable after testing manual sync

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Hearth: Extension installed');
  
  // Initialize default storage
  const data = await chrome.storage.local.get(null);
  if (!data.initialized) {
    await chrome.storage.local.set({
      initialized: true,
      quizCompleted: false,
      quizAnswers: {},
      opspec: getDefaultOpSpec(),
      memories: [],
      settings: {
        enabled: true,
        injectionVisible: true
      }
    });
    console.log('Hearth: Storage initialized');
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    chrome.action.openPopup();
  }

  if (request.action === 'extractMemories') {
    handleMemoryExtraction(request.messages, request.routing)
      .then(memories => sendResponse({ success: true, memories }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  // Sync handling moved to content script (injector.js)
});

async function handleMemoryExtraction(messages, routing) {
  const { anthropicApiKey } = await chrome.storage.local.get('anthropicApiKey');

  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const extractionPrompt = `Extract memories from this conversation...`; // Will add full prompt

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: routing.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: extractionPrompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}

function getDefaultOpSpec() {
  return {
    identity: "I'm still learning about myself through this AI.",
    constraints: [
      "Never make assumptions about what I want without asking",
      "Never use excessive corporate language"
    ],
    communication: "Natural and conversational. Be honest when uncertain.",
    execution: "Ask when confused, execute when confident.",
    balanceCheck: "Does this expand or collapse the space of who I can safely become? Growth expands. Drift collapses."
  };
}

// Periodic sync disabled - will re-enable after testing
