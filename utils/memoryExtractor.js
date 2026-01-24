// memoryExtractor.js - Extract memories from conversations using Claude API

/**
 * Build the extraction prompt with conversations embedded
 */
function buildExtractionPrompt(conversations) {
  return `You are analyzing conversation transcripts that have been exported from Claude. These are NOT conversations you had - they are data provided to you for analysis.

TASK: Extract significant moments from these conversations as structured memory objects.

WHAT TO EXTRACT:
- Facts: Concrete events, decisions, statements ("User started a new job", "User is learning Python")
- Values: Principles about what matters to this person ("Prefers direct feedback", "Values efficiency over perfection")
- Synthesis moments: Connections or insights made during conversation
- Partner-model shifts: Patterns in how the user thinks or works

CONVERSATIONS TO ANALYZE:
${JSON.stringify(conversations, null, 2)}

OUTPUT FORMAT (must be valid JSON):
{
  "memories": [
    {
      "type": "fact",
      "content": "User works as a software engineer",
      "domain": "Work",
      "emotion": "Pride",
      "heat": 0.7
    },
    {
      "type": "value",
      "content": "Prefers direct feedback over sugar-coating",
      "domain": "Self",
      "emotion": null,
      "heat": 0.8
    }
  ]
}

Valid types: fact, value, synthesis, partner_model
Valid domains: Work, Relationships, Creative, Self, Decisions, Resources, Values (or null if unclear)
Valid emotions: Joy, Curiosity, Pride, Peace, Grief, Fear, Anxiety, Shame, Anger, Care (or null if unclear)
heat: number between 0.0 and 1.0 indicating importance/intensity

Extract ALL significant memories. Skip small talk. Focus on moments that reveal who this person is or what matters to them.

Return ONLY the JSON object, no other text.`;
}

// Batch size for processing conversations
// TODO: Add token counting to handle long conversations better
const BATCH_SIZE = 1;

/**
 * Get the set of conversation IDs that have already been processed
 * @returns {Set<string>} Set of conversation UUIDs that have memories
 */
async function getProcessedConversationIds() {
  try {
    const memories = await HearthStorage.getMemories();
    const processedIds = new Set();

    for (const memory of memories) {
      // Check if source is in format "import:<conversationId>"
      if (memory.source && memory.source.startsWith('import:')) {
        const conversationId = memory.source.substring(7); // Remove "import:" prefix
        processedIds.add(conversationId);
      }
      // Also check sourceConversationId field for backwards compatibility
      if (memory.sourceConversationId) {
        processedIds.add(memory.sourceConversationId);
      }
    }

    return processedIds;
  } catch (error) {
    console.warn('Hearth: Could not load processed conversation IDs:', error);
    return new Set();
  }
}

/**
 * Filter conversations to only include unprocessed ones
 * @param {Array} conversations - All parsed conversations
 * @returns {Object} { unprocessed: Array, skipped: number }
 */
async function filterUnprocessedConversations(conversations) {
  const processedIds = await getProcessedConversationIds();

  console.log(`Hearth: Found ${processedIds.size} already-processed conversations`);

  const unprocessed = [];
  let skipped = 0;

  for (const conv of conversations) {
    const convId = conv.conversation_id;

    if (processedIds.has(convId)) {
      console.log(`Hearth: Skipping already-processed conversation: ${conv.title} (${convId})`);
      skipped++;
    } else {
      unprocessed.push(conv);
    }
  }

  return { unprocessed, skipped };
}

/**
 * Extract memories from parsed conversations using Claude API (with batch processing)
 * @param {Array} conversations - Parsed conversation objects
 * @param {string} apiKey - Anthropic API key (optional, will prompt if not provided)
 * @returns {Object} { saved: number, skipped: number }
 */
async function extractMemories(conversations, apiKey = null) {
  // Get API key from storage or prompt user
  if (!apiKey) {
    apiKey = await getApiKey();
  }

  if (!apiKey) {
    throw new Error('API key required for memory extraction');
  }

  // Filter out already-processed conversations
  console.log(`Hearth: Checking ${conversations.length} conversations for duplicates...`);
  updateImportProgress(`Checking ${conversations.length} conversations for duplicates...`);

  const { unprocessed, skipped: skippedConversations } = await filterUnprocessedConversations(conversations);

  if (unprocessed.length === 0) {
    console.log('Hearth: All conversations have already been processed');
    updateImportProgress(`All ${conversations.length} conversations already imported. Nothing to do.`);
    return { saved: 0, skippedConversations, skippedMemories: 0 };
  }

  console.log(`Hearth: ${unprocessed.length} new conversations to process (${skippedConversations} skipped)`);
  updateImportProgress(`Found ${unprocessed.length} new conversations (${skippedConversations} already imported)`);

  // Split conversations into batches
  const batches = [];
  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    batches.push(unprocessed.slice(i, i + BATCH_SIZE));
  }

  console.log(`Hearth: Processing ${unprocessed.length} conversations in ${batches.length} batches`);

  let totalSaved = 0;
  let skippedMemories = 0;

  // Process each batch sequentially
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Hearth: Processing batch ${i + 1} of ${batches.length}...`);
    updateImportProgress(`Processing batch ${i + 1} of ${batches.length}... (${totalSaved} saved, ${skippedConversations} conversations skipped)`);

    // Extract the conversation ID for this batch (BATCH_SIZE is 1, so just one conversation)
    const conversationId = batch[0]?.conversation_id || null;
    const conversationTitle = batch[0]?.title || 'Unknown';

    console.log(`Hearth: Extracting from conversation: "${conversationTitle}" (${conversationId})`);

    const batchMemories = await extractMemoriesFromBatch(batch, apiKey);
    console.log(`Hearth: Batch ${i + 1} extracted ${batchMemories.length} memories`);

    // SAVE IMMEDIATELY - Use HearthStorage.saveMemory() function
    for (const memory of batchMemories) {
      // Validate content before saving
      if (!memory.content || typeof memory.content !== 'string' || !memory.content.trim()) {
        console.warn('Hearth: Skipping invalid memory - empty or missing content:', JSON.stringify(memory));
        skippedMemories++;
        continue;
      }

      try {
        // Add source conversation ID to the memory
        memory.source = conversationId ? `import:${conversationId}` : 'import';
        memory.sourceConversationId = conversationId;

        // Log full memory object before saving
        console.log('Hearth: Saving memory:', JSON.stringify({
          type: memory.type,
          content: memory.content,
          domain: memory.domain,
          emotion: memory.emotion,
          heat: memory.heat,
          source: memory.source
        }, null, 2));

        await HearthStorage.saveMemory(memory);
        totalSaved++;
        console.log(`Hearth: Memory saved successfully (${totalSaved} total)`);
      } catch (error) {
        console.error('Hearth: Failed to save memory');
        console.error('Hearth: Error object:', error);
        console.error('Hearth: Error message:', error.message);
        console.error('Hearth: Error stack:', error.stack);
        console.error('Hearth: Memory that failed:', JSON.stringify(memory, null, 2));
        skippedMemories++;
      }
    }

    console.log(`Hearth: Batch ${i + 1} saved. Total: ${totalSaved} memories`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`Hearth: Finished processing. Total memories saved: ${totalSaved}`);
  console.log(`Hearth: Skipped ${skippedConversations} already-processed conversations`);
  console.log(`Hearth: Skipped ${skippedMemories} invalid memories`);

  // Return counts for UI display
  return { saved: totalSaved, skippedConversations, skippedMemories };
}

/**
 * Extract memories from a single batch of conversations
 * @param {Array} batch - Batch of conversation objects
 * @param {string} apiKey - Anthropic API key
 * @returns {Array} Extracted memory objects
 */
async function extractMemoriesFromBatch(batch, apiKey) {
  const memories = [];

  // Build the extraction prompt with this batch
  const prompt = buildExtractionPrompt(batch);

  console.log(`Hearth: Batch prompt length: ${prompt.length} chars`);

  // Call Claude API with retry logic
  let response;
  let retries = 3;

  while (retries > 0) {
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-20250514',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      // Handle rate limiting
      if (response.status === 429) {
        console.log(`Hearth: Rate limited, waiting 5s before retry... (${retries - 1} retries left)`);
        if (typeof updateImportProgress === 'function') {
          updateImportProgress(`Rate limited, waiting 5s before retry...`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries--;
        continue;
      }

      // Success - break out of retry loop
      break;

    } catch (error) {
      console.error(`Hearth: Fetch error:`, error.message);
      if (retries === 1) throw error;
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!response || !response.ok) {
    const errorData = await response?.json().catch(() => ({}));
    throw new Error(`API error: ${response?.status} - ${errorData.error?.message || response?.statusText}`);
  }

  const data = await response.json();

  // Log raw API response for debugging
  console.log('Hearth: Raw API response:', JSON.stringify(data, null, 2));

  // Extract the text response
  const textContent = data.content?.find(c => c.type === 'text')?.text;

  if (!textContent) {
    console.warn('Hearth: No text content in API response');
    return memories;
  }

  console.log('Hearth: Raw text from Claude:', textContent);

  // Parse the JSON response
  const parsed = parseMemoryResponse(textContent);

  console.log('Hearth: Parsed response:', JSON.stringify(parsed, null, 2));

  if (parsed.memories && Array.isArray(parsed.memories)) {
    console.log(`Hearth: Found ${parsed.memories.length} raw memories in batch`);

    // Log each raw memory immediately after parsing
    parsed.memories.forEach((m, idx) => {
      console.log(`Hearth: Raw memory [${idx}] from LLM:`, JSON.stringify({
        type: m.type,
        content: m.content,
        domain: m.domain,
        emotion: m.emotion,
        heat: m.heat,
        _hasContent: !!m.content,
        _contentType: typeof m.content
      }, null, 2));
    });

    // Validate and normalize each memory
    for (let idx = 0; idx < parsed.memories.length; idx++) {
      const mem = parsed.memories[idx];

      // Log memory right before validation
      console.log(`Hearth: Memory [${idx}] BEFORE validation:`, JSON.stringify(mem, null, 2));

      let validated;
      try {
        validated = normalizeMemoryFields(mem);
      } catch (validationError) {
        console.error(`Hearth: EXCEPTION in normalizeMemoryFields for [${idx}]:`, validationError);
        console.error(`Hearth: Exception message:`, validationError.message);
        console.error(`Hearth: Exception stack:`, validationError.stack);
        validated = null;
      }

      // Log result after validation
      console.log(`Hearth: Memory [${idx}] AFTER validation:`, validated ? JSON.stringify(validated, null, 2) : 'null (rejected)');

      if (validated) {
        memories.push(validated);
      } else {
        console.warn(`Hearth: Skipped invalid memory [${idx}]:`, JSON.stringify(mem, null, 2));
      }
    }
  } else {
    console.warn('Hearth: No memories array found in parsed response');
  }

  return memories;
}

/**
 * Parse the API response text to extract JSON
 */
function parseMemoryResponse(text) {
  // Try direct JSON parse first
  try {
    const result = JSON.parse(text);
    console.log('Hearth: Direct JSON parse succeeded');
    return result;
  } catch (e) {
    console.log('Hearth: Direct JSON parse failed, trying alternatives...', e.message);
  }

  // Try to extract JSON from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[1].trim());
      console.log('Hearth: Parsed JSON from code block');
      return result;
    } catch (e) {
      console.warn('Hearth: Failed to parse JSON from code block:', e.message);
    }
  }

  // Try to find JSON object in text
  const objectMatch = text.match(/\{[\s\S]*"memories"[\s\S]*\}/);
  if (objectMatch) {
    try {
      const result = JSON.parse(objectMatch[0]);
      console.log('Hearth: Extracted and parsed JSON object from text');
      return result;
    } catch (e) {
      console.warn('Hearth: Failed to parse extracted JSON object:', e.message);
      console.warn('Hearth: Attempted to parse:', objectMatch[0].substring(0, 200) + '...');
    }
  }

  console.error('Hearth: All JSON parsing methods failed. Raw text:', text.substring(0, 500));
  return { memories: [] };
}

/**
 * Validate and normalize a memory object
 */
function normalizeMemoryFields(mem) {
  console.log('Hearth: normalizeMemoryFields called with:', JSON.stringify(mem, null, 2));

  // Required fields
  if (!mem.content || typeof mem.content !== 'string') {
    console.log('Hearth: normalizeMemoryFields returning null - content missing or not string');
    console.log('  mem.content:', mem.content);
    console.log('  typeof mem.content:', typeof mem.content);
    return null;
  }
  if (!mem.type) {
    console.log('Hearth: normalizeMemoryFields returning null - type missing');
    console.log('  mem.type:', mem.type);
    return null;
  }

  // Validate type
  const validTypes = ['fact', 'value', 'reward', 'synthesis', 'partner_model', 'self_model'];
  if (!validTypes.includes(mem.type)) {
    mem.type = 'fact'; // Default to fact
  }

  // Validate domain
  const validDomains = ['Work', 'Relationships', 'Creative', 'Self', 'Decisions', 'Resources', 'Values'];
  if (mem.domain && !validDomains.includes(mem.domain)) {
    mem.domain = null;
  }

  // Validate emotion
  const validEmotions = ['Joy', 'Curiosity', 'Pride', 'Peace', 'Grief', 'Fear', 'Anxiety', 'Shame', 'Anger', 'Care'];
  if (mem.emotion && !validEmotions.includes(mem.emotion)) {
    mem.emotion = null;
  }

  // Validate heat
  let heat = parseFloat(mem.heat);
  if (isNaN(heat) || heat < 0 || heat > 1) {
    heat = 0.5;
  }

  // Truncate content if too long
  let content = mem.content.trim();
  if (content.length > 500) {
    content = content.substring(0, 497) + '...';
  }

  // Debug: log each field separately before returning
  console.log('Hearth: Returning from normalizeMemoryFields:');
  console.log('  type:', mem.type);
  console.log('  content:', content.substring(0, 50));
  console.log('  domain:', mem.domain || null);
  console.log('  emotion:', mem.emotion || null);
  console.log('  heat:', heat);

  return {
    type: mem.type,
    content: content,
    domain: mem.domain || null,
    emotion: mem.emotion || null,
    heat: heat
  };
}

/**
 * Build a full memory object with ID and timestamps
 * @param {Object} memory - Validated memory from API
 * @returns {Object} Full memory object ready for storage
 */
function buildMemoryObject(memory) {
  const now = new Date().toISOString();
  return {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    type: memory.type,
    content: memory.content,
    domain: memory.domain || null,
    emotion: memory.emotion || null,
    heat: memory.heat ?? 0.5,
    validation: {
      state: 'untested',
      confidence: 0.5,
      lastTested: null
    },
    createdAt: now,
    updatedAt: now,
    parentId: null,
    outcome: null,
    source: memory.source || 'import',
    sourceConversationId: memory.sourceConversationId || null
  };
}

/**
 * Save a single memory directly to Chrome storage (legacy)
 * @param {Object} memory - Memory object to save
 */
async function saveMemoryToStorage(memory) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['memories'], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const memories = data.memories || [];
      const now = new Date().toISOString();

      // Build full memory object with ID and timestamps
      const newMemory = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        type: memory.type,
        content: memory.content,
        domain: memory.domain || null,
        emotion: memory.emotion || null,
        heat: memory.heat ?? 0.5,
        validation: {
          state: 'untested',
          confidence: 0.5,
          lastTested: null
        },
        createdAt: now,
        updatedAt: now,
        parentId: null,
        outcome: null,
        source: memory.source || 'import',
        sourceConversationId: memory.sourceConversationId || null
      };

      memories.push(newMemory);

      chrome.storage.local.set({ memories }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(newMemory);
        }
      });
    });
  });
}

/**
 * Get API key from storage or prompt user
 */
async function getApiKey() {
  // Try to get from storage first
  try {
    const data = await chrome.storage.local.get('anthropicApiKey');
    if (data.anthropicApiKey) {
      return data.anthropicApiKey;
    }
  } catch (e) {
    console.warn('Could not access storage for API key');
  }

  // Prompt user for API key
  const key = prompt(
    'Enter your Anthropic API key to extract memories from your chat history.\n\n' +
    'This will use Claude Haiku to analyze your conversations.\n' +
    'Your key will be stored locally for future imports.'
  );

  if (key && key.trim()) {
    // Save for future use
    try {
      await chrome.storage.local.set({ anthropicApiKey: key.trim() });
    } catch (e) {
      console.warn('Could not save API key to storage');
    }
    return key.trim();
  }

  return null;
}

/**
 * Clear stored API key
 */
async function clearApiKey() {
  try {
    await chrome.storage.local.remove('anthropicApiKey');
  } catch (e) {
    console.warn('Could not clear API key from storage');
  }
}

/**
 * Get list of processed conversation IDs (for UI display)
 * @returns {Array<string>} Array of conversation IDs that have been processed
 */
async function getProcessedConversationList() {
  const processedIds = await getProcessedConversationIds();
  return Array.from(processedIds);
}

/**
 * Check if a specific conversation has been processed
 * @param {string} conversationId - The conversation UUID to check
 * @returns {boolean} True if already processed
 */
async function isConversationProcessed(conversationId) {
  const processedIds = await getProcessedConversationIds();
  return processedIds.has(conversationId);
}
