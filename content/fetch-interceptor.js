// This script runs in the page context to intercept fetch calls
(function() {
  'use strict';

  // Data received from injector.js
  let hearthData = null;

  // Memory type categories
  const USER_MEMORY_TYPES = ['fact', 'value', 'reward'];
  const AI_MEMORY_TYPES = ['synthesis', 'partner_model', 'self_model'];

  // Listen for data via postMessage (CSP-safe)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'HEARTH_DATA') {
      hearthData = event.data;
      console.log('Hearth: Data received via postMessage');
      console.log('Hearth: Memories count:', hearthData.memories?.length || 0);
      console.log('Hearth: Has OpenAI key:', !!hearthData.openaiApiKey);
    }
  });

  // ============== Heat Detection (inline for page context) ==============

  /**
   * Heat patterns organized by intensity level
   */
  const HEAT_PATTERNS = {
    // HOT (0.6 - 1.0): Crisis, anxiety, deep personal struggles
    hot: {
      baseScore: 0.6,
      maxScore: 1.0,
      patterns: [
        /\b(crisis|emergency|urgent|desperate|can't cope|falling apart)\b/i,
        /\b(suicidal|self.?harm|want to die|end it all|no way out)\b/i,
        /\b(panic|panicking|panic attack|can't breathe|heart racing)\b/i,
        /\b(terrified|petrified|paralyzed|frozen|dread)\b/i,
        /\b(overwhelming|can't handle|too much|breaking down)\b/i,
        /\b(don't know what to do|lost|hopeless|helpless|worthless)\b/i,
        /\b(failing|failure|screwed up|ruined|destroyed)\b/i,
        /\b(hate myself|hate my life|can't go on|giving up)\b/i,
        /\b(betrayed|abandoned|alone|no one understands)\b/i,
        /\b(divorce|cheating|affair|leaving me|broke up)\b/i,
        /\b(abusive|toxic|manipulative|gaslighting)\b/i,
        /\b(fired|laid off|lost my job|evicted|homeless)\b/i,
        /\b(diagnosed|terminal|dying|death|grief|mourning)\b/i,
        /\b(addiction|relapse|rock bottom)\b/i
      ]
    },

    // WARM (0.3 - 0.6): Decisions, changes, moderate emotional weight
    warm: {
      baseScore: 0.3,
      maxScore: 0.6,
      patterns: [
        /\b(thinking about|considering|debating|torn between)\b/i,
        /\b(should I|what should I|do you think I should)\b/i,
        /\b(pros and cons|weighing options|difficult decision)\b/i,
        /\b(not sure if|can't decide|conflicted)\b/i,
        /\b(career change|new job|job offer|promotion)\b/i,
        /\b(moving|relocating|new city|leaving)\b/i,
        /\b(relationship|dating|getting married|having kids)\b/i,
        /\b(starting|quitting|beginning|ending)\b/i,
        /\b(struggling with|working on|trying to)\b/i,
        /\b(frustrated|confused|uncertain|worried|anxious)\b/i,
        /\b(need advice|need help|seeking guidance)\b/i,
        /\b(want to improve|want to change|want to grow)\b/i,
        /\b(believe in|values|principles|what matters)\b/i,
        /\b(who I am|identity|purpose|meaning)\b/i,
        /\b(feel like|feeling|emotions|emotional)\b/i,
        /\b(conversation with|talk to|communicate|conflict)\b/i,
        /\b(family|parent|sibling|friend|partner)\b/i,
        /\b(boundaries|expectations|trust)\b/i
      ]
    },

    // COOL (0.1 - 0.3): Factual, how-to, informational
    cool: {
      baseScore: 0.1,
      maxScore: 0.3,
      patterns: [
        /\b(how do I|how to|how can I|how would I)\b/i,
        /\b(what's the|what is the|what are the)\b/i,
        /\b(where can I|where do I|where is)\b/i,
        /\b(when should I|when do I|when is)\b/i,
        /\b(help me with|help me understand|explain)\b/i,
        /\b(can you show|can you help|can you explain)\b/i,
        /\b(teach me|learn about|understand)\b/i,
        /\b(looking for|searching for|trying to find)\b/i,
        /\b(difference between|compare|comparison)\b/i,
        /\b(recommend|suggestion|best way to)\b/i,
        /\b(example|examples|sample|template)\b/i,
        /\b(code|programming|software|app|website)\b/i,
        /\b(fix|solve|debug|error|issue|problem)\b/i,
        /\b(create|build|make|write|generate)\b/i,
        /\b(steps|process|procedure|guide)\b/i
      ]
    },

    // COLD (0 - 0.1): Greetings, simple requests, casual
    cold: {
      baseScore: 0.0,
      maxScore: 0.1,
      patterns: [
        /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i,
        /\b(how are you|what's up|howdy)\b/i,
        /^(thanks|thank you|thx|ty)\b/i,
        /^(ok|okay|sure|got it|sounds good)\b/i,
        /^(yes|no|maybe|correct|right|wrong)\b/i,
        /\b(makes sense|I see|understood|noted)\b/i,
        /\b(testing|test|ignore|never mind|nvm)\b/i,
        /\b(just wondering|curious|random question)\b/i
      ]
    }
  };

  /**
   * Intensity boosters
   */
  const INTENSITY_BOOSTERS = [
    { pattern: /\b(really|very|extremely|incredibly|absolutely|totally)\b/i, boost: 0.1 },
    { pattern: /\b(always|never|every time|constantly)\b/i, boost: 0.08 },
    { pattern: /\b(need to|have to|must|can't)\b/i, boost: 0.05 },
    { pattern: /!{2,}/g, boost: 0.1 },
    { pattern: /\?{2,}/g, boost: 0.05 },
    { pattern: /\b[A-Z]{3,}\b/g, boost: 0.05 }
  ];

  /**
   * Detect the emotional heat/intensity of a query message
   * @param {string} message - The user's message text
   * @returns {number} Heat score between 0.0 and 1.0
   */
  function detectQueryHeat(message) {
    if (!message || typeof message !== 'string') {
      return 0.0;
    }

    const text = message.trim();
    if (text.length === 0) {
      return 0.0;
    }

    // Track matches by category
    const matches = { hot: 0, warm: 0, cool: 0, cold: 0 };

    // Count pattern matches in each category
    for (const [category, config] of Object.entries(HEAT_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (text.match(pattern)) {
          matches[category]++;
        }
      }
    }

    // Determine primary category and base score
    let baseScore = 0.0;
    let maxScore = 0.1;

    if (matches.hot > 0) {
      baseScore = HEAT_PATTERNS.hot.baseScore;
      maxScore = HEAT_PATTERNS.hot.maxScore;
      baseScore = Math.min(baseScore + (matches.hot - 1) * 0.1, maxScore);
    } else if (matches.warm > 0) {
      baseScore = HEAT_PATTERNS.warm.baseScore;
      maxScore = HEAT_PATTERNS.warm.maxScore;
      baseScore = Math.min(baseScore + (matches.warm - 1) * 0.08, maxScore);
    } else if (matches.cool > 0) {
      baseScore = HEAT_PATTERNS.cool.baseScore;
      maxScore = HEAT_PATTERNS.cool.maxScore;
      baseScore = Math.min(baseScore + (matches.cool - 1) * 0.05, maxScore);
    } else if (matches.cold > 0) {
      baseScore = HEAT_PATTERNS.cold.baseScore;
      maxScore = HEAT_PATTERNS.cold.maxScore;
    } else {
      // No patterns matched - default to cool
      baseScore = 0.15;
      maxScore = 0.25;
    }

    // Apply intensity boosters
    let boost = 0;
    for (const booster of INTENSITY_BOOSTERS) {
      const found = text.match(booster.pattern);
      if (found) {
        const matchCount = Array.isArray(found) ? found.length : 1;
        boost += booster.boost * Math.min(matchCount, 2);
      }
    }

    let finalScore = Math.min(baseScore + boost, maxScore, 1.0);
    return Math.round(finalScore * 100) / 100;
  }

  /**
   * Get heat level label
   */
  function getHeatLabel(heat) {
    if (heat >= 0.6) return 'HOT';
    if (heat >= 0.3) return 'WARM';
    if (heat >= 0.1) return 'COOL';
    return 'COLD';
  }

  // ============== Temporal Filtering ==============

  /**
   * Filter memories by recency based on query heat level
   * @param {Array} memories - All valid memories
   * @param {number} queryHeat - Detected query heat (0-1)
   * @returns {Array} Temporally filtered memories
   */
  function filterMemoriesByHeat(memories, queryHeat) {
    if (!memories || memories.length === 0) {
      return [];
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Determine time window based on heat
    let maxAgeDays;
    let heatLevel;

    if (queryHeat < 0.1) {
      // COLD: No memories needed for greetings/simple requests
      heatLevel = 'COLD';
      maxAgeDays = 0; // Return empty
    } else if (queryHeat < 0.3) {
      // COOL: Only recent memories (30 days)
      heatLevel = 'COOL';
      maxAgeDays = 30;
    } else if (queryHeat < 0.6) {
      // WARM: Medium-term memories (90 days)
      heatLevel = 'WARM';
      maxAgeDays = 90;
    } else {
      // HOT: All memories - no time limit
      heatLevel = 'HOT';
      maxAgeDays = Infinity;
    }

    // Return empty for cold queries
    if (maxAgeDays === 0) {
      console.log(`Hearth: Heat ${heatLevel} (${queryHeat.toFixed(2)}) - skipping memories for simple query`);
      return [];
    }

    // Filter by date
    const cutoffTime = maxAgeDays === Infinity ? 0 : now - (maxAgeDays * DAY_MS);

    const filtered = memories.filter(m => {
      // Parse memory date
      const memoryDate = m.createdAt || m.updatedAt;
      if (!memoryDate) {
        // No date = include for hot, exclude otherwise
        return queryHeat >= 0.6;
      }

      const memoryTime = new Date(memoryDate).getTime();
      return memoryTime >= cutoffTime;
    });

    console.log(`Hearth: Heat ${heatLevel} (${queryHeat.toFixed(2)}) - temporal gate passed ${filtered.length}/${memories.length} memories (${maxAgeDays === Infinity ? 'all time' : `last ${maxAgeDays} days`})`);

    return filtered;
  }

  // ============== Embedding Functions (inline for page context) ==============

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Generate embedding for text using OpenAI API
   */
  async function generateQueryEmbedding(text, apiKey) {
    if (!text || !apiKey) {
      return null;
    }

    // Truncate if too long
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: truncatedText
        })
      });

      if (!response.ok) {
        console.warn('Hearth: Embedding API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (error) {
      console.warn('Hearth: Embedding generation failed:', error.message);
      return null;
    }
  }

  /**
   * Find most similar memories using embeddings
   * @param {number} minSimilarity - Minimum similarity threshold (0-1)
   */
  function findSimilarMemoriesByEmbedding(queryEmbedding, memories, topK = 15, minSimilarity = 0.55) {
    // Filter memories that have embeddings
    const memoriesWithEmbeddings = memories.filter(m =>
      m.embedding && Array.isArray(m.embedding) && m.embedding.length > 0
    );

    if (memoriesWithEmbeddings.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const scored = memoriesWithEmbeddings.map(memory => ({
      ...memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding)
    }));

    // Filter by minimum similarity threshold
    const aboveThreshold = scored.filter(m => m.similarity >= minSimilarity);

    if (aboveThreshold.length === 0) {
      console.log(`Hearth: No memories above ${minSimilarity} similarity threshold`);
      return [];
    }

    // Sort by similarity (highest first) and return top K
    aboveThreshold.sort((a, b) => b.similarity - a.similarity);

    console.log(`Hearth: ${aboveThreshold.length} memories above ${minSimilarity} threshold, top similarity: ${aboveThreshold[0]?.similarity.toFixed(3)}`);

    return aboveThreshold.slice(0, topK);
  }

  // ============== Memory Selection ==============

  /**
   * Get memories using heat-based sorting (fallback method)
   */
  function getMemoriesByHeat(memories, limit = 15) {
    if (!memories || memories.length === 0) {
      return [];
    }

    // Filter out invalidated memories
    const injectable = memories.filter(m => {
      const state = m.validation?.state || 'untested';
      return state === 'validated' || state === 'untested';
    });

    // Sort by heat (highest first)
    injectable.sort((a, b) => (b.heat ?? 0.5) - (a.heat ?? 0.5));

    return injectable.slice(0, limit);
  }

  /**
   * Get relevant memories - applies heat-based temporal filtering, then semantic retrieval
   */
  async function getRelevantMemories(userMessage, memories, apiKey) {
    // Filter out invalidated memories first
    const validMemories = (memories || []).filter(m => {
      const state = m.validation?.state || 'untested';
      return state === 'validated' || state === 'untested';
    });

    if (validMemories.length === 0) {
      return [];
    }

    // Step 1: Detect query heat
    const queryHeat = detectQueryHeat(userMessage);
    const heatLabel = getHeatLabel(queryHeat);
    console.log(`Hearth: Query heat detected: ${queryHeat.toFixed(2)} (${heatLabel})`);

    // Step 2: Apply temporal filter based on heat
    const temporallyFiltered = filterMemoriesByHeat(validMemories, queryHeat);

    // If temporal filter returned empty (cold query), return empty
    if (temporallyFiltered.length === 0) {
      console.log('Hearth: No memories after temporal filter (cold/simple query)');
      return [];
    }

    // Step 3: Apply semantic retrieval on temporally filtered set
    if (apiKey && userMessage) {
      // Log what we're embedding for debugging
      const queryPreview = userMessage.length > 100 ? userMessage.substring(0, 100) + '...' : userMessage;
      console.log(`Hearth: Embedding query: "${queryPreview}"`);
      console.log(`Hearth: Attempting semantic retrieval on ${temporallyFiltered.length} temporally-filtered memories...`);

      const queryEmbedding = await generateQueryEmbedding(userMessage, apiKey);

      if (queryEmbedding) {
        const similar = findSimilarMemoriesByEmbedding(queryEmbedding, temporallyFiltered, 15);

        if (similar.length > 0) {
          console.log(`Hearth: Semantic retrieval found ${similar.length} relevant memories`);
          return similar;
        } else {
          // No memories passed threshold - return EMPTY, not fallback
          // This prevents irrelevant memories from being injected
          console.log('Hearth: No memories above similarity threshold - returning empty (no fallback)');
          return [];
        }
      }

      console.log('Hearth: Embedding generation failed, falling back to heat-based');
    }

    // Fallback to heat-based ONLY if no API key (semantic not attempted)
    console.log('Hearth: Using heat-based memory selection (no API key)');
    return getMemoriesByHeat(temporallyFiltered, 15);
  }

  // ============== Context Building ==============

  /**
   * Format a single memory line for injection
   */
  function formatMemoryLine(memory) {
    const typeLabel = `[${memory.type.toUpperCase()}]`;
    const heat = memory.heat ?? 0.5;
    const heatStr = `${heat.toFixed(1)} heat`;

    // Add similarity score if available
    const simStr = memory.similarity !== undefined
      ? `, ${(memory.similarity * 100).toFixed(0)}% relevant`
      : '';

    const tags = [];
    if (memory.domain) tags.push(memory.domain);

    if (tags.length > 0) {
      return `- ${typeLabel} ${memory.content} [${tags.join(', ')}, ${heatStr}${simStr}]`;
    } else {
      return `- ${typeLabel} ${memory.content} [${heatStr}${simStr}]`;
    }
  }

  /**
   * Build the full injection context with OpSpec and relevant memories
   */
  function buildInjectionContext(opspec, memories) {
    const { cognitiveArchitecture, identity, constraints, communication, execution, balanceProtocol } = opspec;
    const constraintsList = (constraints || []).map((c, i) => `${i + 1}. ${c}`).join('\n');

    // Separate memories by type
    const userMemories = memories.filter(m => USER_MEMORY_TYPES.includes(m.type));
    const aiMemories = memories.filter(m => AI_MEMORY_TYPES.includes(m.type));

    // Build memory sections
    let memoriesSection = '';

    if (userMemories.length > 0) {
      const userLines = userMemories.map(m => formatMemoryLine(m)).join('\n');
      memoriesSection += `\n\nUSER MEMORIES (${userMemories.length} most relevant)\n${userLines}`;
    }

    if (aiMemories.length > 0) {
      const aiLines = aiMemories.map(m => formatMemoryLine(m)).join('\n');
      memoriesSection += `\n\nAI MEMORIES (${aiMemories.length} most relevant)\n${aiLines}`;
    }

    // Build balance protocol section if present
    let balanceSection = '';
    if (balanceProtocol) {
      balanceSection = `

---

### SECTION 4: BALANCE PROTOCOL
${balanceProtocol}`;
    }

    return `[HEARTH CONTEXT]

### SECTION 1: THE INTERNAL COUNCIL (Cognitive Architecture)
${cognitiveArchitecture || ''}

---

### SECTION 2: IDENTITY & PREFERENCES (The "Soul")
${identity}

**Communication Style:**
${communication}

**Execution Protocol:**
${execution}

---

### SECTION 3: IMMUTABLE CONSTRAINTS (The "Law")
${constraintsList}${balanceSection}${memoriesSection}

[END HEARTH CONTEXT]`;
  }

  // ============== Message Extraction ==============

  /**
   * Extract user message from different API request formats
   */
  function extractUserMessage(url, body) {
    try {
      // ChatGPT
      if (url.includes('chatgpt.com') || url.includes('api.openai.com')) {
        if (body.messages && body.messages.length > 0) {
          const lastMsg = body.messages[body.messages.length - 1];
          // ChatGPT web uses author.role and content.parts
          if (lastMsg.author?.role === 'user' && lastMsg.content?.parts) {
            return lastMsg.content.parts[0];
          }
          // API format
          if (lastMsg.role === 'user') {
            if (typeof lastMsg.content === 'string') {
              return lastMsg.content;
            }
            if (Array.isArray(lastMsg.content)) {
              const textBlock = lastMsg.content.find(c => c.type === 'text');
              return textBlock?.text || '';
            }
          }
        }
      }

      // Claude
      if (url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/')) {
        if (body.prompt) {
          return body.prompt;
        }
        if (body.messages && body.messages.length > 0) {
          const lastMsg = body.messages[body.messages.length - 1];
          if (lastMsg.role === 'user') {
            if (typeof lastMsg.content === 'string') {
              return lastMsg.content;
            }
            if (Array.isArray(lastMsg.content)) {
              const textBlock = lastMsg.content.find(c => c.type === 'text');
              return textBlock?.text || '';
            }
          }
        }
      }

      // Gemini
      if (url.includes('generativelanguage.googleapis.com')) {
        if (body.contents && body.contents.length > 0) {
          const lastContent = body.contents[body.contents.length - 1];
          if (lastContent.parts && lastContent.parts.length > 0) {
            const textPart = lastContent.parts.find(p => p.text);
            return textPart?.text || '';
          }
        }
      }
    } catch (e) {
      console.warn('Hearth: Failed to extract user message', e);
    }

    return '';
  }

  /**
   * Inject context into request body
   */
  function injectContext(url, body, context) {
    // ChatGPT
    if (url.includes('api.openai.com/v1/chat/completions') ||
        (url.includes('chatgpt.com/backend-api') && url.includes('conversation'))) {
      if (body.messages && body.messages.length > 0) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg.author?.role === 'user' && lastMsg.content?.parts) {
          lastMsg.content.parts[0] = `${context}\n\n${lastMsg.content.parts[0]}`;
          console.log('Hearth: Injected into ChatGPT request');
          return true;
        }
      }
    }

    // Claude
    if (url.includes('/completion') || url.includes('/chat_conversations/')) {
      if (body.prompt) {
        body.prompt = `${context}\n\n${body.prompt}`;
        console.log('Hearth: Injected into Claude request');
        return true;
      }
      if (body.messages && body.messages.length > 0) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg.role === 'user') {
          if (typeof lastMsg.content === 'string') {
            lastMsg.content = `${context}\n\n${lastMsg.content}`;
          } else if (Array.isArray(lastMsg.content)) {
            const textBlock = lastMsg.content.find(c => c.type === 'text');
            if (textBlock) {
              textBlock.text = `${context}\n\n${textBlock.text}`;
            }
          }
          console.log('Hearth: Injected into Claude request');
          return true;
        }
      }
    }

    // Gemini
    if (url.includes('generativelanguage.googleapis.com')) {
      if (body.contents && body.contents.length > 0) {
        const lastContent = body.contents[body.contents.length - 1];
        if (lastContent.parts && lastContent.parts.length > 0) {
          const textPart = lastContent.parts.find(p => p.text);
          if (textPart) {
            textPart.text = `${context}\n\n${textPart.text}`;
            console.log('Hearth: Injected into Gemini request');
            return true;
          }
        }
      }
    }

    return false;
  }

  // ============== Conversation Monitor Integration ==============

  /**
   * Send message to conversation monitor via postMessage
   */
  function sendToConversationMonitor(role, content) {
    if (!content || content.trim().length === 0) return;

    // Skip Hearth context blocks
    if (content.includes('[HEARTH CONTEXT]')) return;

    window.postMessage({
      type: 'HEARTH_CONVERSATION_MESSAGE',
      role,
      content: content.trim()
    }, '*');

    console.log(`Hearth: Buffered ${role} message for conversation monitor (${content.length} chars)`);
  }

  /**
   * Extract assistant response from API response body
   */
  function extractAssistantResponse(url, responseData) {
    try {
      // ChatGPT / OpenAI
      if (url.includes('api.openai.com') || url.includes('chatgpt.com')) {
        if (responseData.choices && responseData.choices[0]) {
          const choice = responseData.choices[0];
          // Standard API format
          if (choice.message?.content) {
            return choice.message.content;
          }
          // Streaming delta format
          if (choice.delta?.content) {
            return choice.delta.content;
          }
        }
        // ChatGPT web format
        if (responseData.message?.content?.parts) {
          return responseData.message.content.parts.join('\n');
        }
      }

      // Claude
      if (url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/')) {
        // Claude API format
        if (responseData.content && Array.isArray(responseData.content)) {
          const textBlocks = responseData.content
            .filter(c => c.type === 'text')
            .map(c => c.text);
          if (textBlocks.length > 0) {
            return textBlocks.join('\n');
          }
        }
        // Claude web format
        if (responseData.completion) {
          return responseData.completion;
        }
      }

      // Gemini
      if (url.includes('generativelanguage.googleapis.com')) {
        if (responseData.candidates && responseData.candidates[0]) {
          const parts = responseData.candidates[0].content?.parts;
          if (parts) {
            return parts.map(p => p.text).join('\n');
          }
        }
      }
    } catch (e) {
      console.warn('Hearth: Failed to extract assistant response', e);
    }

    return null;
  }

  // ============== Fetch Interception ==============

  // Store original fetch
  const originalFetch = window.fetch;

  // Monkeypatch fetch
  window.fetch = async function(...args) {
    const [url, options] = args;

    let capturedUserMessage = null;
    let isAIRequest = false;

    // Only intercept POST requests to AI APIs when we have data
    if (options?.method === 'POST' && hearthData?.opspec) {
      console.log('Hearth: Intercepting POST to:', url);

      try {
        // Check body type before parsing
        if (options.body instanceof FormData) {
          console.log('Hearth: Skipping FormData request');
          // Skip - will fall through to original fetch
        } else if (typeof options.body !== 'string') {
          console.log('Hearth: Skipping non-string request body:', typeof options.body);
          // Skip - will fall through to original fetch
        } else {
          // Parse JSON body
          let body;
          try {
            body = JSON.parse(options.body);
          } catch (parseError) {
            console.log('Hearth: Non-JSON request body, skipping');
            body = null;
          }

          if (body) {
            // Check if this is an AI API request
            isAIRequest =
              url.includes('api.openai.com') ||
              url.includes('chatgpt.com') ||
              url.includes('claude.ai') ||
              url.includes('/completion') ||
              url.includes('/chat_conversations/') ||
              url.includes('generativelanguage.googleapis.com');

            if (isAIRequest) {
              // Extract user message for heat detection and semantic retrieval
              capturedUserMessage = extractUserMessage(url, body);
              console.log('Hearth: User message length:', capturedUserMessage.length);

              // Get relevant memories (with heat-based temporal filtering + semantic)
              const relevantMemories = await getRelevantMemories(
                capturedUserMessage,
                hearthData.memories,
                hearthData.openaiApiKey
              );

              console.log('Hearth: Selected', relevantMemories.length, 'memories for injection');

              // Build context with relevant memories
              const context = buildInjectionContext(hearthData.opspec, relevantMemories);

              // Inject context into request
              if (injectContext(url, body, context)) {
                options.body = JSON.stringify(body);
              }
            }
          }
        }
      } catch (e) {
        console.error('Hearth: Failed to process request', e);
      }
    }

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // After response: capture messages for conversation monitor
    if (isAIRequest && capturedUserMessage && response.ok) {
      try {
        // Send user message to monitor
        sendToConversationMonitor('user', capturedUserMessage);

        // Clone response to read body without consuming it
        const clonedResponse = response.clone();

        // Check content type - only process JSON responses (not streaming)
        const contentType = response.headers.get('content-type') || '';
        console.log('Hearth: Response content-type:', contentType);

        // Detect streaming - Claude uses various content types
        const isStreaming = contentType.includes('text/event-stream') ||
                           contentType.includes('text/plain') ||
                           contentType.includes('application/x-ndjson') ||
                           url.includes('stream=true');

        if (isStreaming) {
          // Streaming response - collect chunks
          console.log('Hearth: Streaming response detected, monitoring will collect chunks');

          collectStreamingResponse(clonedResponse, url).then(assistantMessage => {
            if (assistantMessage && assistantMessage.length > 0) {
              console.log('Hearth: Collected streaming response:', assistantMessage.length, 'chars');
              sendToConversationMonitor('assistant', assistantMessage);
            }
          }).catch(e => {
            console.warn('Hearth: Could not collect streaming response', e.message);
          });
        } else if (contentType.includes('application/json')) {
          // Non-streaming JSON response - extract assistant message
          clonedResponse.json().then(responseData => {
            const assistantMessage = extractAssistantResponse(url, responseData);
            if (assistantMessage) {
              sendToConversationMonitor('assistant', assistantMessage);
            }
          }).catch(e => {
            console.warn('Hearth: Could not parse JSON response for monitoring', e.message);
          });
        } else {
          console.log('Hearth: Unknown content-type, skipping response monitoring:', contentType);
        }
      } catch (monitorError) {
        console.warn('Hearth: Conversation monitor integration error', monitorError);
      }
    }

    return response;
  };

  /**
   * Collect streaming response chunks into complete message
   */
  async function collectStreamingResponse(response, url) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // OpenAI/ChatGPT streaming format
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content;
              }

              // Claude streaming format
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
              }

              // Gemini streaming format
              if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                fullContent += parsed.candidates[0].content.parts[0].text;
              }
            } catch (parseError) {
              // Skip non-JSON lines
            }
          }
        }
      }

      return fullContent || null;
    } catch (e) {
      console.warn('Hearth: Error collecting streaming response', e);
      return null;
    }
  }

  console.log('Hearth: Fetch interceptor active (with heat detection + semantic retrieval + conversation monitoring)');
})();
