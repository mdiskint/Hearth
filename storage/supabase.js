/**
 * Supabase Client for Hearth V2
 * Full paper implementation: embeddings, semantic search, validation lifecycle
 */

const SUPABASE_URL = 'https://wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

// OpenAI for embeddings (user provides key via settings)
let OPENAI_API_KEY = null;

/**
 * Set OpenAI API key for embedding generation
 */
function setOpenAIKey(key) {
  OPENAI_API_KEY = key;
}

/**
 * Generate embedding for text using OpenAI
 * @param {string} text - Text to embed
 * @returns {Promise<number[]|null>} 1536-dim embedding or null
 */
async function generateEmbedding(text) {
  if (!OPENAI_API_KEY) {
    console.warn('Hearth: No OpenAI key set, skipping embedding');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    if (!response.ok) {
      console.error('Hearth: OpenAI embedding failed', response.status);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Hearth: Embedding error', error);
    return null;
  }
}

/**
 * Fetch all memories from Supabase (basic fetch, no filtering)
 * @returns {Promise<Array>} Array of memory objects
 */
async function fetchMemories() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Hearth: Supabase fetch failed', response.status);
      return [];
    }

    const memories = await response.json();
    console.log(`Hearth: Loaded ${memories.length} memories from Supabase`);
    return memories;
  } catch (error) {
    console.error('Hearth: Supabase error', error);
    return [];
  }
}

/**
 * Semantic search using embeddings
 * Implements: similarity × intensity × precision (validation)
 * 
 * @param {string} query - Query text to search for
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Ranked memories with resonance scores
 */
async function searchMemoriesSemantic(query, options = {}) {
  const {
    matchThreshold = 0.25,  // Lowered from 0.5 - embeddings often have low cosine similarity
    maxResults = 20,
    memoryType = null,      // 'user' | 'ai' | null (both)
    lifeDomain = null,      // filter by domain
    minDate = null,         // for heat-gated temporal depth
    includeWithoutEmbedding = true  // fallback for unembedded memories
  } = options;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  if (!queryEmbedding) {
    console.warn('Hearth: No embedding generated, falling back to basic fetch');
    return fetchMemories();
  }

  try {
    // Use Supabase RPC to call search function
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/search_memories`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: maxResults,
          filter_memory_type: memoryType,
          filter_life_domain: lifeDomain,
          min_date: minDate
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hearth: Semantic search failed', response.status, errorText);
      return [];
    }

    const memories = await response.json();

    // Calculate resonance score: similarity × intensity × precision × durability
    const queryHeat = options.queryHeat || 0;
    const scoredMemories = memories.map(m => {
      const similarity = m.similarity || 0.5;
      const intensity = m.intensity || 0.5;
      const precision = getValidationPrecision(m.validation_state);
      const durabilityMultiplier = getDurabilityMultiplier(m.durability, queryHeat);

      return {
        ...m,
        resonance: similarity * intensity * precision * durabilityMultiplier,
        _scores: { similarity, intensity, precision, durabilityMultiplier }
      };
    });

    // Sort by resonance
    scoredMemories.sort((a, b) => b.resonance - a.resonance);

    console.log(`Hearth: Semantic search returned ${scoredMemories.length} memories`);
    return scoredMemories;

  } catch (error) {
    console.error('Hearth: Semantic search error', error);
    return [];
  }
}

/**
 * Get precision multiplier based on validation state
 * validated = 1.0, untested = 0.5, invalidated = 0.2
 */
function getValidationPrecision(state) {
  switch (state) {
    case 'validated': return 1.0;
    case 'provisional': return 0.7;
    case 'untested': return 0.5;
    case 'invalidated': return 0.2;
    default: return 0.5;
  }
}

/**
 * Get durability multiplier based on memory durability and query heat
 * Hot queries (>=0.6): boost durable memories (deep patterns matter most)
 * Medium queries (0.3-0.6): neutral
 * Low-heat queries (<0.3): boost ephemeral/contextual (task-relevant), penalize durable
 */
function getDurabilityMultiplier(durability, queryHeat) {
  if (queryHeat >= 0.6) {
    // Hot: durable memories are most valuable
    if (durability === 'durable') return 1.5;
    return 1.0;
  } else if (queryHeat < 0.3) {
    // Cool: task-level and project-state memories win
    if (durability === 'ephemeral' || durability === 'contextual') return 1.3;
    if (durability === 'durable') return 0.7;
    return 1.0;
  }
  // Medium: no adjustment
  return 1.0;
}

/**
 * Heat-gated retrieval
 * Maps query heat to temporal depth
 * 
 * @param {string} query - User query
 * @param {number} heat - Heat score 0-1
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Memories filtered by heat-appropriate time window
 */
async function retrieveByHeat(query, heat, options = {}) {
  const {
    maxResults = 10,
    memoryType = null,
    lifeDomain = null
  } = options;

  // Heat gates temporal depth
  let minDate = null;
  const now = new Date();

  if (heat < 0.1) {
    // Cold: no retrieval
    console.log('Hearth: Cold query, no memory retrieval');
    return [];
  } else if (heat < 0.3) {
    // Cool: last 30 days only
    minDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    console.log('Hearth: Cool query, 30-day window');
  } else if (heat < 0.6) {
    // Warm: last 90 days
    minDate = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    console.log('Hearth: Warm query, 90-day window');
  } else {
    // Hot: full archive access
    console.log('Hearth: Hot query, full archive access');
  }

  return searchMemoriesSemantic(query, {
    matchThreshold: 0.2,  // Lower threshold for heat-based retrieval
    maxResults,
    memoryType,
    lifeDomain,
    minDate,
    queryHeat: heat        // Pass heat for durability weighting
  });
}

/**
 * Write a memory with full V2 schema
 * @param {Object} memory - Memory object with V2 fields
 * @returns {Promise<Object|null>} Inserted row or null
 */
async function writeMemory(memory) {
  // Generate embedding for content
  const embedding = await generateEmbedding(memory.content);

  const memoryWithEmbedding = {
    ...memory,
    id: memory.id || crypto.randomUUID(),
    embedding: embedding,
    created_at: memory.created_at || new Date().toISOString()
  };

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/memories`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(memoryWithEmbedding)
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Hearth: Memory write failed', response.status, errorBody);
      return null;
    }

    const rows = await response.json();
    console.log('Hearth: Memory written with embedding');
    return rows[0] || null;
  } catch (error) {
    console.error('Hearth: Memory write error', error);
    return null;
  }
}

/**
 * Write an AI memory (synthesis, self-model update)
 * @param {Object} aiMemory - AI memory object
 * @returns {Promise<Object|null>}
 */
async function writeAIMemory(aiMemory) {
  return writeMemory({
    ...aiMemory,
    memory_type: 'ai',
    type: aiMemory.type || 'synthesis'
  });
}

/**
 * Update memory validation state
 * @param {string} memoryId - UUID of memory
 * @param {string} newState - 'validated' | 'invalidated' | 'provisional'
 */
async function updateValidation(memoryId, newState) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/validate_memory`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          memory_id: memoryId,
          new_state: newState,
          increment_count: true
        })
      }
    );

    if (!response.ok) {
      console.error('Hearth: Validation update failed', response.status);
    }
  } catch (error) {
    console.error('Hearth: Validation update error', error);
  }
}

/**
 * Record access for a batch of memories (for tracking utility)
 * @param {string[]} memoryIds - Array of memory UUIDs
 */
async function touchMemories(memoryIds) {
  if (!memoryIds || memoryIds.length === 0) return;

  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/touch_memories`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memory_ids: memoryIds })
      }
    );
  } catch (error) {
    console.error('Hearth: Touch memories error', error);
  }
}

/**
 * Get dimensional coverage for gap detection
 * @returns {Promise<Object>} Coverage map and gaps
 */
async function getDimensionalCoverage() {
  try {
    // Get coverage
    const coverageResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/memory_dimension_coverage?select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    // Get gaps
    const gapsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/memory_dimension_gaps?select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    const coverage = coverageResponse.ok ? await coverageResponse.json() : [];
    const gaps = gapsResponse.ok ? await gapsResponse.json() : [];

    return { coverage, gaps };
  } catch (error) {
    console.error('Hearth: Dimensional coverage error', error);
    return { coverage: [], gaps: [] };
  }
}

/**
 * Backfill embeddings for existing memories without them
 * @param {number} batchSize - Number to process at a time
 * @returns {Promise<number>} Count of memories updated
 */
async function backfillEmbeddings(batchSize = 50) {
  if (!OPENAI_API_KEY) {
    console.error('Hearth: Cannot backfill without OpenAI key');
    return 0;
  }

  try {
    // Fetch all memories and filter client-side for those without embeddings
    // (PostgREST doesn't handle is.null correctly for vector columns)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?select=id,content,embedding&order=created_at.asc&limit=1000`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.error('Hearth: Failed to fetch memories for backfill');
      return 0;
    }

    const allMemories = await response.json();
    // Filter to only those without embeddings
    const memories = allMemories.filter(m => !m.embedding).slice(0, batchSize);
    console.log(`Hearth: Found ${memories.length} memories without embeddings (of ${allMemories.length} total)`);

    if (memories.length === 0) {
      console.log('Hearth: All memories already have embeddings');
      return 0;
    }

    let updated = 0;
    for (const memory of memories) {
      const embedding = await generateEmbedding(memory.content);
      if (embedding) {
        // Update memory with embedding
        const updateResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/memories?id=eq.${memory.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ embedding })
          }
        );

        if (updateResponse.ok) {
          updated++;
          console.log(`Hearth: Backfilled ${updated}/${memories.length}`);
        } else {
          console.error('Hearth: Failed to update memory', memory.id, await updateResponse.text());
        }

        // Rate limit: ~3 per second to stay under OpenAI limits
        await new Promise(r => setTimeout(r, 350));
      }
    }

    return updated;
  } catch (error) {
    console.error('Hearth: Backfill error', error);
    return 0;
  }
}

/**
 * Classify memory into life domain based on content
 * @param {string} content - Memory content
 * @returns {string|null} Life domain or null
 */
function classifyLifeDomain(content) {
  const text = content.toLowerCase();

  const domainKeywords = {
    work: ['job', 'career', 'work', 'office', 'colleague', 'boss', 'project', 'deadline', 'meeting', 'salary', 'promotion'],
    relationships: ['friend', 'family', 'partner', 'wife', 'husband', 'parent', 'child', 'dating', 'relationship', 'social'],
    creative: ['write', 'create', 'art', 'music', 'design', 'story', 'creative', 'idea', 'imagination', 'build'],
    self: ['feel', 'think', 'believe', 'identity', 'personality', 'habit', 'routine', 'health', 'mental', 'growth'],
    decisions: ['decide', 'choice', 'option', 'should', 'whether', 'pros', 'cons', 'tradeoff', 'commit', 'change'],
    resources: ['money', 'time', 'budget', 'save', 'spend', 'invest', 'cost', 'afford', 'resource', 'manage'],
    values: ['believe', 'value', 'important', 'principle', 'ethics', 'meaning', 'purpose', 'integrity', 'priority', 'matter']
  };

  let bestMatch = null;
  let bestCount = 0;

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    const count = keywords.filter(k => text.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      bestMatch = domain;
    }
  }

  return bestMatch;
}

/**
 * Classify memory into emotional state based on content
 * @param {string} content - Memory content
 * @returns {string|null} Emotional state or null
 */
function classifyEmotionalState(content) {
  const text = content.toLowerCase();

  const emotionKeywords = {
    joy: ['happy', 'excited', 'thrilled', 'delighted', 'joy', 'wonderful', 'amazing', 'love', 'celebrate'],
    curiosity: ['curious', 'wonder', 'explore', 'learn', 'discover', 'interesting', 'fascinated', 'question'],
    pride: ['proud', 'accomplished', 'achieved', 'succeeded', 'mastered', 'confident', 'capable'],
    peace: ['calm', 'peaceful', 'content', 'relaxed', 'serene', 'balanced', 'accepting', 'settled'],
    grief: ['loss', 'grief', 'mourning', 'miss', 'gone', 'died', 'passed', 'goodbye'],
    fear: ['afraid', 'scared', 'terrified', 'fear', 'dread', 'worried', 'panic'],
    anxiety: ['anxious', 'nervous', 'worried', 'stress', 'overwhelmed', 'uncertain', 'uneasy'],
    shame: ['shame', 'embarrassed', 'guilty', 'regret', 'stupid', 'failure', 'worthless'],
    anger: ['angry', 'frustrated', 'furious', 'annoyed', 'irritated', 'resentful', 'mad'],
    care: ['care', 'concern', 'help', 'support', 'protect', 'nurture', 'compassion', 'empathy']
  };

  let bestMatch = null;
  let bestCount = 0;

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    const count = keywords.filter(k => text.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      bestMatch = emotion;
    }
  }

  return bestMatch;
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.HearthSupabase = {
    // Config
    setOpenAIKey,

    // Basic operations
    fetchMemories,
    writeMemory,
    writeAIMemory,

    // Semantic search
    generateEmbedding,
    searchMemoriesSemantic,
    retrieveByHeat,

    // Validation lifecycle
    updateValidation,
    touchMemories,

    // Dimensional analysis
    getDimensionalCoverage,
    classifyLifeDomain,
    classifyEmotionalState,

    // Maintenance
    backfillEmbeddings
  };
}

// Export for module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setOpenAIKey,
    fetchMemories,
    writeMemory,
    writeAIMemory,
    generateEmbedding,
    searchMemoriesSemantic,
    retrieveByHeat,
    updateValidation,
    touchMemories,
    getDimensionalCoverage,
    classifyLifeDomain,
    classifyEmotionalState,
    backfillEmbeddings
  };
}
