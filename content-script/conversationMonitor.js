// conversationMonitor.js - Live conversation monitoring and memory extraction

(function() {
  'use strict';

  // ============== Configuration ==============

  const CONFIG = {
    enabled: false, // Flag to enable/disable live extraction
    maxBufferSize: 10, // Maximum messages in buffer
    extractionTriggerCount: 5, // Extract after this many exchanges
    idleTimeoutMs: 2 * 60 * 1000, // 2 minutes idle triggers extraction
    minMessagesForExtraction: 2, // Minimum messages needed to extract
    apiModel: 'claude-sonnet-4-20250514', // Use Sonnet for faster/cheaper live extraction
    maxTokens: 2048
  };

  // ============== State ==============

  let messageBuffer = [];
  let lastMessageTime = null;
  let idleTimer = null;
  let exchangeCount = 0;
  let isExtracting = false;
  let anthropicApiKey = null;

  // ============== Initialization ==============

  /**
   * Initialize the conversation monitor
   * Note: This script runs in PAGE context, not content script context
   * So it receives settings via postMessage from injector.js
   */
  function init() {
    console.log('Hearth ConversationMonitor: Initializing (page context)...');

    // Listen for settings from injector.js (content script)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'HEARTH_MONITOR_SETTINGS') {
        anthropicApiKey = event.data.anthropicApiKey || null;
        const wasEnabled = CONFIG.enabled;
        CONFIG.enabled = event.data.liveExtractionEnabled || false;

        console.log('Hearth ConversationMonitor: Settings received');
        console.log('Hearth ConversationMonitor: Live extraction', CONFIG.enabled ? 'ENABLED' : 'DISABLED');
        console.log('Hearth ConversationMonitor: API key', anthropicApiKey ? 'available' : 'not configured');

        // Start or stop monitoring based on setting change
        if (CONFIG.enabled && !wasEnabled) {
          startMonitoring();
        } else if (!CONFIG.enabled && wasEnabled) {
          stopMonitoring();
        }
      }
    });

    // Also listen for conversation messages (from fetch-interceptor)
    window.addEventListener('message', handleMessage);

    console.log('Hearth ConversationMonitor: Waiting for settings...');
  }

  // ============== Message Monitoring ==============

  /**
   * Start monitoring for new messages
   */
  function startMonitoring() {
    console.log('Hearth ConversationMonitor: Message monitoring ACTIVE');
    // Message listener is already set up in init()
    // This function is called when live extraction is enabled
  }

  /**
   * Stop monitoring
   */
  function stopMonitoring() {
    console.log('Hearth ConversationMonitor: Message monitoring PAUSED');
    // We don't remove the message listener, just ignore messages when disabled
    clearIdleTimer();
    // Clear buffer when stopping
    messageBuffer = [];
    exchangeCount = 0;
  }

  /**
   * Handle incoming message events
   */
  function handleMessage(event) {
    if (!CONFIG.enabled) return;

    // Listen for conversation messages
    if (event.data && event.data.type === 'HEARTH_CONVERSATION_MESSAGE') {
      addMessageToBuffer(event.data.role, event.data.content);
    }
  }

  /**
   * Observe DOM for message additions (platform-specific)
   */
  function observeDOM() {
    // This is a fallback - primary method is intercepting API responses
    // Platform-specific selectors would go here
    console.log('Hearth ConversationMonitor: DOM observation ready (fallback mode)');
  }

  // ============== Message Buffer ==============

  /**
   * Add a message to the buffer
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  function addMessageToBuffer(role, content) {
    if (!CONFIG.enabled || !content || content.trim().length === 0) {
      return;
    }

    // Skip if content looks like Hearth context injection
    if (content.includes('[HEARTH CONTEXT]') || content.includes('[END HEARTH CONTEXT]')) {
      return;
    }

    const message = {
      role,
      content: content.trim(),
      timestamp: new Date().toISOString()
    };

    messageBuffer.push(message);
    lastMessageTime = Date.now();

    console.log(`Hearth ConversationMonitor: Buffered ${role} message (${messageBuffer.length}/${CONFIG.maxBufferSize})`);

    // Trim buffer if too large
    if (messageBuffer.length > CONFIG.maxBufferSize) {
      messageBuffer = messageBuffer.slice(-CONFIG.maxBufferSize);
    }

    // Count exchanges (user + assistant = 1 exchange)
    if (role === 'assistant') {
      exchangeCount++;
      console.log(`Hearth ConversationMonitor: Exchange count: ${exchangeCount}`);

      // Check if we should extract
      if (exchangeCount >= CONFIG.extractionTriggerCount) {
        triggerExtraction('exchange_count');
      }
    }

    // Reset idle timer
    resetIdleTimer();
  }

  /**
   * Reset the idle timer
   */
  function resetIdleTimer() {
    clearIdleTimer();

    idleTimer = setTimeout(() => {
      if (messageBuffer.length >= CONFIG.minMessagesForExtraction) {
        triggerExtraction('idle_timeout');
      }
    }, CONFIG.idleTimeoutMs);
  }

  /**
   * Clear the idle timer
   */
  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  // ============== Memory Extraction ==============

  /**
   * Trigger memory extraction from buffered messages
   * @param {string} reason - Why extraction was triggered
   */
  async function triggerExtraction(reason) {
    if (isExtracting) {
      console.log('Hearth ConversationMonitor: Extraction already in progress, skipping');
      return;
    }

    if (messageBuffer.length < CONFIG.minMessagesForExtraction) {
      console.log('Hearth ConversationMonitor: Not enough messages for extraction');
      return;
    }

    if (!anthropicApiKey) {
      console.warn('Hearth ConversationMonitor: No API key configured, cannot extract');
      return;
    }

    isExtracting = true;
    console.log(`Hearth ConversationMonitor: Triggering extraction (reason: ${reason})`);
    console.log(`Hearth ConversationMonitor: Processing ${messageBuffer.length} messages`);

    try {
      // Copy buffer and clear for new messages
      const messagesToProcess = [...messageBuffer];
      messageBuffer = [];
      exchangeCount = 0;

      // Extract memories
      const memories = await extractMemoriesFromMessages(messagesToProcess);

      console.log(`Hearth ConversationMonitor: Extracted ${memories.length} memories`);

      // Send memories to content script for saving (HearthStorage not available in page context)
      for (const memory of memories) {
        // Add source tracking
        memory.source = 'live';

        // Send via postMessage to content script which has access to HearthStorage
        window.postMessage({
          type: 'HEARTH_SAVE_MEMORY',
          memory
        }, '*');

        console.log(`Hearth ConversationMonitor: Sent memory for saving: "${memory.content.substring(0, 50)}..."`);
      }

      console.log(`Hearth ConversationMonitor: Sent ${memories.length} memories to content script for saving`);

    } catch (error) {
      console.error('Hearth ConversationMonitor: Extraction failed:', error);
    } finally {
      isExtracting = false;
    }
  }

  /**
   * Extract memories from a set of messages using Claude API
   * @param {Array} messages - Array of message objects
   * @returns {Array} Extracted memory objects
   */
  async function extractMemoriesFromMessages(messages) {
    const prompt = buildExtractionPrompt(messages);

    console.log(`Hearth ConversationMonitor: Calling API with ${prompt.length} chars`);

    // Get routing decision based on conversation complexity
    const routing = window.ModelRouter
      ? window.ModelRouter.getRoutingDecision(messages)
      : { model: CONFIG.apiModel, modelName: 'Sonnet 4', complexityScore: 0, reasoning: 'Default' };

    console.log(`Hearth ConversationMonitor: Using ${routing.modelName} (score: ${routing.complexityScore}) - ${routing.reasoning}`);

    let response;
    let retries = 2;

    while (retries > 0) {
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: routing.model,
            max_tokens: CONFIG.maxTokens,
            messages: [{
              role: 'user',
              content: prompt
            }]
          })
        });

        if (response.status === 429) {
          console.log('Hearth ConversationMonitor: Rate limited, waiting...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          retries--;
          continue;
        }

        break;
      } catch (error) {
        console.error('Hearth ConversationMonitor: Fetch error:', error.message);
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!response || !response.ok) {
      const errorData = await response?.json().catch(() => ({}));
      throw new Error(`API error: ${response?.status} - ${errorData.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    const textContent = data.content?.find(c => c.type === 'text')?.text;

    if (!textContent) {
      console.warn('Hearth ConversationMonitor: No text in API response');
      return [];
    }

    // Parse and validate memories
    const parsed = parseMemoryResponse(textContent);
    const validMemories = [];

    if (parsed.memories && Array.isArray(parsed.memories)) {
      for (const mem of parsed.memories) {
        const validated = normalizeMemoryFields(mem);
        if (validated) {
          validMemories.push(validated);
        }
      }
    }

    return validMemories;
  }

  /**
   * Build extraction prompt for live messages
   */
  function buildExtractionPrompt(messages) {
    const formattedMessages = messages.map(m =>
      `[${m.role.toUpperCase()}]: ${m.content}`
    ).join('\n\n');

    return `You are analyzing a live conversation excerpt. Extract any significant information as structured memory objects.

CONVERSATION:
${formattedMessages}

EXTRACT (if present):
- Facts: Concrete information about the user (events, preferences, background)
- Values: Principles about what matters to this person
- Synthesis: Insights or realizations expressed during the conversation

OUTPUT FORMAT (must be valid JSON):
{
  "memories": [
    {
      "type": "fact",
      "content": "Brief description of the memory",
      "domain": "Work",
      "emotion": null,
      "heat": 0.6
    }
  ]
}

Valid types: fact, value, synthesis
Valid domains: Work, Relationships, Creative, Self, Decisions, Resources, Values (or null)
Valid emotions: Joy, Curiosity, Pride, Peace, Grief, Fear, Anxiety, Shame, Anger, Care (or null)
heat: 0.0-1.0 indicating importance

Only extract genuinely significant information. Skip routine exchanges.
If nothing significant, return: {"memories": []}

Return ONLY the JSON object.`;
  }

  /**
   * Parse API response to extract JSON
   */
  function parseMemoryResponse(text) {
    // Try direct parse
    try {
      return JSON.parse(text);
    } catch (e) {}

    // Try code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e) {}
    }

    // Try finding JSON object
    const objectMatch = text.match(/\{[\s\S]*"memories"[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e) {}
    }

    return { memories: [] };
  }

  /**
   * Validate and normalize memory fields
   */
  function normalizeMemoryFields(mem) {
    if (!mem.content || typeof mem.content !== 'string' || !mem.content.trim()) {
      return null;
    }
    if (!mem.type) {
      return null;
    }

    const validTypes = ['fact', 'value', 'synthesis', 'partner_model', 'self_model'];
    if (!validTypes.includes(mem.type)) {
      mem.type = 'fact';
    }

    const validDomains = ['Work', 'Relationships', 'Creative', 'Self', 'Decisions', 'Resources', 'Values'];
    if (mem.domain && !validDomains.includes(mem.domain)) {
      mem.domain = null;
    }

    const validEmotions = ['Joy', 'Curiosity', 'Pride', 'Peace', 'Grief', 'Fear', 'Anxiety', 'Shame', 'Anger', 'Care'];
    if (mem.emotion && !validEmotions.includes(mem.emotion)) {
      mem.emotion = null;
    }

    let heat = parseFloat(mem.heat);
    if (isNaN(heat) || heat < 0 || heat > 1) {
      heat = 0.5;
    }

    let content = mem.content.trim();
    if (content.length > 500) {
      content = content.substring(0, 497) + '...';
    }

    return {
      type: mem.type,
      content,
      domain: mem.domain || null,
      emotion: mem.emotion || null,
      heat
    };
  }

  // ============== Public API ==============

  /**
   * Enable live extraction
   */
  function enable() {
    CONFIG.enabled = true;
    startMonitoring();
    // Notify content script to persist setting
    window.postMessage({ type: 'HEARTH_MONITOR_SETTING_CHANGE', liveExtractionEnabled: true }, '*');
    console.log('Hearth ConversationMonitor: Live extraction ENABLED');
  }

  /**
   * Disable live extraction
   */
  function disable() {
    CONFIG.enabled = false;
    stopMonitoring();
    // Notify content script to persist setting
    window.postMessage({ type: 'HEARTH_MONITOR_SETTING_CHANGE', liveExtractionEnabled: false }, '*');
    console.log('Hearth ConversationMonitor: Live extraction DISABLED');
  }

  /**
   * Toggle live extraction
   */
  function toggle() {
    if (CONFIG.enabled) {
      disable();
    } else {
      enable();
    }
    return CONFIG.enabled;
  }

  /**
   * Get current status
   */
  function getStatus() {
    return {
      enabled: CONFIG.enabled,
      bufferSize: messageBuffer.length,
      exchangeCount,
      isExtracting,
      hasApiKey: !!anthropicApiKey
    };
  }

  /**
   * Manually add a message (for integration with fetch interceptor)
   */
  function addMessage(role, content) {
    addMessageToBuffer(role, content);
  }

  /**
   * Force extraction now
   */
  function extractNow() {
    triggerExtraction('manual');
  }

  // Expose public API to page context
  window.HearthConversationMonitor = {
    enable,
    disable,
    toggle,
    getStatus,
    addMessage,
    extractNow,
    // Direct method to update settings from page context
    updateSettings: function(apiKey, enabled) {
      anthropicApiKey = apiKey;
      const wasEnabled = CONFIG.enabled;
      CONFIG.enabled = enabled;
      if (enabled && !wasEnabled) startMonitoring();
      if (!enabled && wasEnabled) stopMonitoring();
    }
  };

  // Initialize immediately (runs in page context)
  init();

  console.log('Hearth ConversationMonitor: Loaded (page context)');
})();
