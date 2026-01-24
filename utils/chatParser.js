// chatParser.js - Parse Claude conversation export format

/**
 * Parse Claude's conversation export JSON format
 * @param {Object|Array} jsonData - The exported JSON data from Claude
 * @returns {Array} Array of conversation objects with normalized message structure
 */
function parseClaudeExport(jsonData) {
  const conversations = [];

  try {
    // Handle different export formats
    let rawConversations = [];

    // Format 1: Array of conversations
    if (Array.isArray(jsonData)) {
      rawConversations = jsonData;
    }
    // Format 2: Object with conversations array
    else if (jsonData.conversations && Array.isArray(jsonData.conversations)) {
      rawConversations = jsonData.conversations;
    }
    // Format 3: Single conversation object
    else if (jsonData.chat_messages || jsonData.messages) {
      rawConversations = [jsonData];
    }
    // Format 4: Object with nested data
    else if (jsonData.data && Array.isArray(jsonData.data)) {
      rawConversations = jsonData.data;
    }

    // Process each conversation
    for (const conv of rawConversations) {
      const parsed = parseConversation(conv);
      if (parsed && parsed.messages.length > 0) {
        conversations.push(parsed);
      }
    }

  } catch (error) {
    console.error('Error parsing Claude export:', error);
  }

  return conversations;
}

/**
 * Parse a single conversation object
 * @param {Object} conv - Raw conversation object
 * @returns {Object} Normalized conversation with id and messages array
 */
function parseConversation(conv) {
  if (!conv) return null;

  const conversation = {
    conversation_id: conv.uuid || conv.id || conv.conversation_id || generateId(),
    title: conv.name || conv.title || 'Untitled',
    created_at: conv.created_at || conv.createdAt || null,
    messages: []
  };

  // Try different message array locations
  const rawMessages = conv.chat_messages || conv.messages || conv.content || [];

  for (const msg of rawMessages) {
    const parsed = parseMessage(msg);
    if (parsed) {
      conversation.messages.push(parsed);
    }
  }

  return conversation;
}

/**
 * Parse a single message object
 * @param {Object} msg - Raw message object
 * @returns {Object} Normalized message with role, content, timestamp
 */
function parseMessage(msg) {
  if (!msg) return null;

  // Determine role
  let role = 'unknown';
  if (msg.sender === 'human' || msg.role === 'user' || msg.type === 'human') {
    role = 'user';
  } else if (msg.sender === 'assistant' || msg.role === 'assistant' || msg.type === 'assistant') {
    role = 'assistant';
  }

  // Skip system messages or unknown roles
  if (role === 'unknown') return null;

  // Extract content
  let content = '';
  if (typeof msg.text === 'string') {
    content = msg.text;
  } else if (typeof msg.content === 'string') {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    // Handle content blocks (Claude's format)
    content = msg.content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text)
      .join('\n');
  } else if (msg.message) {
    content = typeof msg.message === 'string' ? msg.message : '';
  }

  // Skip empty messages
  if (!content.trim()) return null;

  return {
    role,
    content: content.trim(),
    timestamp: msg.created_at || msg.createdAt || msg.timestamp || null
  };
}

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Summarize conversations for memory extraction prompt
 * Limits total content to avoid token limits
 * @param {Array} conversations - Parsed conversations
 * @param {number} maxChars - Maximum characters to include
 * @returns {string} Summarized text for API call
 */
function summarizeConversations(conversations, maxChars = 50000) {
  let summary = '';
  let charCount = 0;

  for (const conv of conversations) {
    if (charCount >= maxChars) break;

    const convHeader = `\n--- Conversation: ${conv.title} ---\n`;
    summary += convHeader;
    charCount += convHeader.length;

    for (const msg of conv.messages) {
      const msgText = `[${msg.role.toUpperCase()}]: ${msg.content}\n`;

      if (charCount + msgText.length > maxChars) {
        summary += '... (truncated)\n';
        break;
      }

      summary += msgText;
      charCount += msgText.length;
    }
  }

  return summary;
}
