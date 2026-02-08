/**
 * Hearth Retrieval Pipeline
 *
 * Heat-gated, goal-weighted memory retrieval with dual-pool vector search.
 * 10-step pipeline: heat gate -> goal classify -> temporal window -> embed ->
 * parallel search -> dedup -> score -> diverse select -> format -> track access.
 *
 * Fail-open everywhere. If anything errors, return null injection.
 * Retrieval never blocks the conversation.
 */

// ============================================================
// CSP-safe fetch proxy
// ============================================================
// This module runs in PAGE context (injected <script> tag), which is
// subject to the host page's Content Security Policy. Claude.ai / ChatGPT
// restrict connect-src, blocking direct fetch to api.openai.com and
// supabase.co. We proxy fetch calls through the content script (injector.js)
// via postMessage, which bypasses page CSP.

const _pendingFetches = new Map();
let _fetchIdCounter = 0;

function proxyFetch(url, options) {
  return new Promise((resolve, reject) => {
    const id = ++_fetchIdCounter;
    _pendingFetches.set(id, { resolve, reject });

    window.postMessage({
      type: 'HEARTH_PROXY_FETCH',
      id,
      url,
      options: {
        method: options.method,
        headers: options.headers,
        body: options.body,
      },
    }, '*');

    // Timeout after 15 seconds
    setTimeout(() => {
      if (_pendingFetches.has(id)) {
        _pendingFetches.delete(id);
        reject(new Error(`Proxy fetch timeout: ${url}`));
      }
    }, 15000);
  });
}

// Listen for proxy fetch responses from the content script
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'HEARTH_PROXY_FETCH_RESPONSE') {
      const pending = _pendingFetches.get(event.data.id);
      if (pending) {
        _pendingFetches.delete(event.data.id);
        if (event.data.error) {
          pending.reject(new Error(event.data.error));
        } else {
          // Return a fetch-Response-like object with .ok and .json()
          pending.resolve({
            ok: event.data.ok,
            status: event.data.status,
            json: () => Promise.resolve(event.data.body),
          });
        }
      }
    }
  });
}

// ============================================================
// Configuration
// ============================================================

const DEFAULTS = {
  SIMILARITY_THRESHOLD: 0.35,
  MAX_CANDIDATES: 15,
  MAX_USER_MEMORIES: 3,
  MAX_AI_MEMORIES: 3,
  MIN_SCORE: 0.15,
};

let config = { ...DEFAULTS };
let SUPABASE_URL = null;
let SUPABASE_ANON_KEY = null;
let OPENAI_API_KEY = null;

/**
 * Initialize the retrieval module with API credentials.
 * Call once at startup before any retrieve() calls.
 *
 * @param {Object} cfg
 * @param {string} cfg.supabaseUrl       - Supabase project URL
 * @param {string} cfg.supabaseAnonKey   - Supabase publishable anon key
 * @param {string} cfg.openaiApiKey      - OpenAI API key for embeddings
 * @param {Object} [cfg.overrides]       - Optional config overrides (thresholds, limits)
 */
function init(cfg) {
  if (!cfg) {
    console.error('Hearth retrieval: init() called with no config');
    return;
  }

  const missing = [];
  if (!cfg.supabaseUrl) missing.push('supabaseUrl');
  if (!cfg.supabaseAnonKey) missing.push('supabaseAnonKey');
  if (!cfg.openaiApiKey) missing.push('openaiApiKey');

  if (missing.length > 0) {
    console.error('Hearth retrieval: init() missing required config:', missing.join(', '));
  }

  SUPABASE_URL = cfg.supabaseUrl;
  SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
  OPENAI_API_KEY = cfg.openaiApiKey;
  if (cfg.overrides) {
    config = { ...DEFAULTS, ...cfg.overrides };
  }

  console.log('Hearth retrieval: initialized',
    'supabaseUrl:', !!SUPABASE_URL,
    'supabaseAnonKey:', !!SUPABASE_ANON_KEY,
    'openaiApiKey:', !!OPENAI_API_KEY
  );
}

// ============================================================
// Step 1: Heat Gate
// ============================================================

/**
 * Compute heat from a 3-axis affect shape.
 * Activation is primary; contraction and uncertainty boost.
 *
 * @param {Object} shape - { expansion, activation, certainty } each -1..+1
 * @returns {number} heat 0..1
 */
function computeHeatFromAffect({ expansion = 0, activation = 0, certainty = 0 }) {
  const activationHeat = Math.abs(activation);
  const contractionBoost = Math.max(0, -expansion) * 0.4;
  const uncertaintyBoost = Math.max(0, -certainty) * 0.2;
  return Math.min(1, activationHeat + contractionBoost + uncertaintyBoost);
}

/**
 * Estimate heat from raw query text when no affect shape is available.
 * Layered regex heuristic: crisis > reflective > substance > factual > greeting.
 *
 * @param {string} query
 * @returns {number} heat 0..1
 */
function estimateHeatFromQuery(query) {
  if (!query || typeof query !== 'string') return 0.2;
  const text = query.trim();
  if (text.length === 0) return 0.2;
  const lower = text.toLowerCase();

  // Cold: greetings, short utility
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|sure|got it|yes|no|yo|sup)\b/i.test(text)) {
    return 0.05;
  }

  // Cold: simple factual / how-to
  if (/^(what('s| is) the |define |how do I install|what time|what day)/i.test(text)) {
    return 0.08;
  }

  // Hot: existential / crisis language
  if (/\b(terrified|don't know what to do|failed|what's wrong with me|can't do this anymore|falling apart|hopeless|helpless|worthless|panic|suicidal|want to die|can't cope|desperate|rock bottom|hate myself)\b/i.test(lower)) {
    return 0.85;
  }

  // Warm: reflective / uncertain
  if (/\b(i've been thinking|should i|i'm feeling|my life|my career|my future|i wonder|struggling with|torn between|conflicted|not sure if|meaning|purpose|identity)\b/i.test(lower)) {
    return 0.5;
  }

  // Cool: has substance but not emotionally charged
  if (text.length > 60) {
    return 0.25;
  }

  // Default
  return 0.2;
}

// ============================================================
// Step 2: Goal Classification
// ============================================================

const GOAL_PATTERNS = {
  emotional: /\b(feel|feeling|felt|emotion|sad|happy|angry|anxious|scared|hurt|grief|love|lonely|ashamed|guilty|overwhelmed|depressed|upset|stressed)\b/i,
  technical: /\b(code|bug|error|function|api|database|deploy|server|syntax|debug|programming|software|algorithm|git|npm|build|compile|refactor)\b/i,
  decisional: /\b(should i|decide|decision|choice|choosing|option|pros and cons|trade.?off|weigh|compare|alternative|commit to|go with)\b/i,
  creative: /\b(idea|create|write|story|design|imagine|brainstorm|concept|draft|poem|essay|novel|art|compose|invent)\b/i,
  strategic: /\b(plan|strategy|goal|roadmap|priority|timeline|milestone|objective|approach|framework|long.?term|next step|scaling|growth)\b/i,
  relational: /\b(relationship|partner|friend|family|parent|colleague|boss|coworker|communication|boundary|trust|conflict|conversation with|talk to)\b/i,
};

/**
 * Classify the user's query into a goal category.
 *
 * @param {string} query
 * @returns {string} one of: emotional, technical, decisional, creative, strategic, relational, general
 */
function classifyGoal(query) {
  if (!query) return 'general';
  const lower = query.toLowerCase();

  // Count matches per category; highest wins
  let best = 'general';
  let bestCount = 0;

  for (const [goal, pattern] of Object.entries(GOAL_PATTERNS)) {
    const matches = lower.match(new RegExp(pattern.source, 'gi'));
    const count = matches ? matches.length : 0;
    if (count > bestCount) {
      bestCount = count;
      best = goal;
    }
  }

  return best;
}

// ============================================================
// Step 3: Temporal Window
// ============================================================

/**
 * Map heat to a temporal cutoff date.
 *
 * @param {number} heat - 0..1
 * @returns {{ cutoffDate: string|null, label: string }}
 */
function getTemporalWindow(heat) {
  const now = Date.now();

  if (heat < 0.1) {
    return { cutoffDate: null, label: 'none (cold)' };
  }
  if (heat < 0.3) {
    const d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    return { cutoffDate: d.toISOString(), label: '7 days' };
  }
  if (heat < 0.6) {
    const d = new Date(now - 30 * 24 * 60 * 60 * 1000);
    return { cutoffDate: d.toISOString(), label: '30 days' };
  }
  if (heat < 0.8) {
    const d = new Date(now - 90 * 24 * 60 * 60 * 1000);
    return { cutoffDate: d.toISOString(), label: '90 days' };
  }

  // 0.8+ : full archive
  return { cutoffDate: null, label: 'full archive' };
}

// ============================================================
// Step 4: Embed Query
// ============================================================

/**
 * Generate a 1536-dim embedding via OpenAI text-embedding-3-small.
 *
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function embedQuery(text) {
  if (!OPENAI_API_KEY) return null;

  try {
    const res = await proxyFetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.data[0].embedding;
  } catch {
    return null;
  }
}

// ============================================================
// Step 5: Parallel Vector Search
// ============================================================

/**
 * Call Supabase match_memories RPC for a single pool.
 *
 * @param {number[]} embedding
 * @param {string}   pool          - 'user' | 'ai'
 * @param {string|null} cutoffDate - ISO date or null for full archive
 * @returns {Promise<Array>}
 */
async function searchPool(embedding, pool, cutoffDate) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];

  try {
    const res = await proxyFetch(`${SUPABASE_URL}/rest/v1/rpc/match_memories`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_embedding: embedding,
        similarity_threshold: config.SIMILARITY_THRESHOLD,
        max_results: config.MAX_CANDIDATES,
        memory_pool: pool,
        cutoff_date: cutoffDate,
      }),
    });

    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r) => ({ ...r, pool }));
  } catch {
    return [];
  }
}

// ============================================================
// Step 6: Deduplicate
// ============================================================

/**
 * Remove near-duplicate candidates. Two memories are duplicates if their
 * content shares the same first 50 characters. Keep the higher-similarity one.
 *
 * @param {Array} candidates
 * @returns {Array}
 */
function deduplicate(candidates) {
  const seen = new Map();

  for (const c of candidates) {
    const key = (c.content || '').substring(0, 50);
    const existing = seen.get(key);
    if (!existing || (c.similarity || 0) > (existing.similarity || 0)) {
      seen.set(key, c);
    }
  }

  return Array.from(seen.values());
}

// ============================================================
// Step 7: Score
// ============================================================

/** Goal -> memory type relevance weights */
const TYPE_WEIGHTS = {
  emotional:  { fact: 0.3, value: 1.0, reward: 0.6, synthesis: 1.0, partner_model: 0.9, self_model: 0.7 },
  technical:  { fact: 1.0, value: 0.2, reward: 0.3, synthesis: 0.6, partner_model: 0.3, self_model: 0.2 },
  decisional: { fact: 0.7, value: 1.0, reward: 0.9, synthesis: 0.9, partner_model: 0.7, self_model: 0.5 },
  creative:   { fact: 0.4, value: 0.7, reward: 0.3, synthesis: 0.9, partner_model: 0.5, self_model: 0.4 },
  strategic:  { fact: 0.6, value: 0.9, reward: 0.7, synthesis: 1.0, partner_model: 0.8, self_model: 0.6 },
  relational: { fact: 0.7, value: 0.9, reward: 0.6, synthesis: 0.7, partner_model: 1.0, self_model: 0.8 },
  general:    { fact: 1.0, value: 1.0, reward: 1.0, synthesis: 1.0, partner_model: 1.0, self_model: 1.0 },
};

/** Validation state -> precision multiplier */
const VALIDATION_PRECISION = {
  validated: 1.0,
  untested: 0.7,
  invalidated: 0.1,
};

/**
 * Compute composite score for a candidate memory.
 *
 * score = similarity * type_relevance * validation_precision * intensity_factor
 *
 * @param {Object} candidate - memory row from match_memories
 * @param {string} goal      - classified goal category
 * @returns {number}
 */
function scoreCandidate(candidate, goal) {
  const similarity = candidate.similarity || 0;
  const type = candidate.type || 'fact';
  const goalWeights = TYPE_WEIGHTS[goal] || TYPE_WEIGHTS.general;
  const typeRelevance = goalWeights[type] ?? 0.5;
  const validation = candidate.validation || 'untested';
  const validationPrecision = VALIDATION_PRECISION[validation] ?? 0.7;
  const intensity = candidate.intensity || 0.5;
  const intensityFactor = 0.5 + intensity * 0.5; // maps 0..1 to 0.5..1.0

  const score = similarity * typeRelevance * validationPrecision * intensityFactor;
  return score;
}

// ============================================================
// Step 8: Diverse Selection
// ============================================================

/**
 * Two-pass diverse selection.
 * Pass 1: pick the best candidate of each TYPE (up to limits).
 * Pass 2: fill remaining slots with highest-scoring candidates.
 *
 * @param {Array}  scored  - candidates with .score, .pool, .type
 * @param {number} maxUser - max user-pool memories
 * @param {number} maxAI   - max AI-pool memories
 * @param {number} minScore - minimum score threshold
 * @returns {{ userMemories: Array, aiMemories: Array }}
 */
function diverseSelect(scored, maxUser, maxAI, minScore) {
  // Filter below minimum score
  const viable = scored.filter((c) => c.score >= minScore);

  // Split by pool
  const userCandidates = viable.filter((c) => c.pool === 'user');
  const aiCandidates = viable.filter((c) => c.pool === 'ai');

  const pickDiverse = (candidates, max) => {
    if (candidates.length === 0) return [];

    const selected = [];
    const usedTypes = new Set();
    const usedIds = new Set();

    // Sort descending by score
    const sorted = [...candidates].sort((a, b) => b.score - a.score);

    // Pass 1: best of each type
    for (const c of sorted) {
      if (selected.length >= max) break;
      if (!usedTypes.has(c.type) && !usedIds.has(c.id)) {
        selected.push(c);
        usedTypes.add(c.type);
        usedIds.add(c.id);
      }
    }

    // Pass 2: fill remaining with highest scores
    for (const c of sorted) {
      if (selected.length >= max) break;
      if (!usedIds.has(c.id)) {
        selected.push(c);
        usedIds.add(c.id);
      }
    }

    return selected;
  };

  return {
    userMemories: pickDiverse(userCandidates, maxUser),
    aiMemories: pickDiverse(aiCandidates, maxAI),
  };
}

// ============================================================
// Step 9: Format Injection
// ============================================================

/**
 * Format selected memories into injection text.
 * Returns null if no memories survived selection.
 *
 * @param {Array} userMemories
 * @param {Array} aiMemories
 * @returns {string|null}
 */
function formatInjection(userMemories, aiMemories) {
  if (userMemories.length === 0 && aiMemories.length === 0) return null;

  const lines = ['[MEMORIES]'];

  if (userMemories.length > 0) {
    lines.push('What you know about this person:');
    for (const m of userMemories) {
      lines.push(`- ${m.content}`);
    }
  }

  if (aiMemories.length > 0) {
    if (userMemories.length > 0) lines.push('');
    lines.push("What you've learned from working with them:");
    for (const m of aiMemories) {
      lines.push(`- ${m.content}`);
    }
  }

  lines.push('[/MEMORIES]');
  return lines.join('\n');
}

// ============================================================
// Step 10: Track Access
// ============================================================

/**
 * Fire-and-forget call to record_memory_access.
 * Non-blocking, silent fail.
 *
 * @param {string[]} memoryIds
 */
function trackAccess(memoryIds) {
  if (!memoryIds || memoryIds.length === 0) return;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  // Fire and forget
  proxyFetch(`${SUPABASE_URL}/rest/v1/rpc/record_memory_access`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ memory_ids: memoryIds }),
  }).catch(() => {
    // Silent fail - access tracking is non-critical
  });
}

// ============================================================
// Main Pipeline
// ============================================================

/**
 * Run the full retrieval pipeline.
 * Every message gets embedded and semantically searched. No heat gating.
 * Similarity threshold is the gate.
 *
 * @param {string} query - The user's message text
 * @returns {Promise<{ userMemories: Array, aiMemories: Array, injection: string|null, goal: string, debug: Object }>}
 */
async function retrieve(query) {
  const emptyResult = (goal = 'general') => ({
    userMemories: [],
    aiMemories: [],
    injection: null,
    goal,
    debug: { candidateCounts: { user: 0, ai: 0 }, afterDedup: 0, topScores: [] },
  });

  try {
    // --- Step 1: Embed query ---
    console.log('Hearth: Embedding message...');
    const embedding = await embedQuery(query);
    if (!embedding) {
      console.warn('Hearth: Embedding failed, skipping retrieval');
      return emptyResult();
    }

    // --- Step 2: Parallel vector search (all memories, no date restriction) ---
    const ALL_TIME = '2020-01-01T00:00:00Z';
    const [userResults, aiResults] = await Promise.all([
      searchPool(embedding, 'user', ALL_TIME),
      searchPool(embedding, 'ai', ALL_TIME),
    ]);

    const allCandidates = [...userResults, ...aiResults];
    console.log('Hearth: Semantic search returned', allCandidates.length, 'candidates above threshold');

    // Pattern/fact re-ranking — patterns encode process (more useful for shaping model behavior)
    const PATTERN_BOOST = 1.3;
    const FACT_WEIGHT = 0.85;
    for (const m of allCandidates) {
      m.similarity = m.similarity * (m.memory_class === 'pattern' ? PATTERN_BOOST : FACT_WEIGHT);
    }

    if (allCandidates.length === 0) {
      return emptyResult();
    }

    // --- Step 3: Goal classification ---
    const goal = classifyGoal(query);
    console.log('Hearth: Goal:', goal);

    // --- Step 4: Deduplicate ---
    const deduped = deduplicate(allCandidates);

    // --- Step 5: Score ---
    const scored = deduped.map((c) => ({
      ...c,
      score: scoreCandidate(c, goal),
    }));

    // --- Step 6: Diverse selection ---
    const { userMemories, aiMemories } = diverseSelect(
      scored,
      config.MAX_USER_MEMORIES,
      config.MAX_AI_MEMORIES,
      config.MIN_SCORE,
    );

    const totalSelected = userMemories.length + aiMemories.length;
    console.log('Hearth: Final memories to inject:', totalSelected);

    // --- Step 7: Format injection ---
    const injection = formatInjection(userMemories, aiMemories);

    // --- Step 8: Track access (fire-and-forget) ---
    const accessedIds = [...userMemories, ...aiMemories]
      .map((m) => m.id)
      .filter(Boolean);
    trackAccess(accessedIds);

    // --- Build debug info ---
    const topScores = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((c) => ({ id: c.id, type: c.type, pool: c.pool, score: Math.round(c.score * 1000) / 1000 }));

    return {
      userMemories,
      aiMemories,
      injection,
      goal,
      debug: {
        candidateCounts: { user: userResults.length, ai: aiResults.length },
        afterDedup: deduped.length,
        topScores,
      },
    };
  } catch (err) {
    console.warn('Hearth retrieval: pipeline error, failing open', err);
    return emptyResult();
  }
}

// ============================================================
// Exports
// ============================================================

// Export for browser / page context (loaded via <script> tag)
if (typeof window !== 'undefined') {
  window.HearthRetrieval = {
    init,
    retrieve,
    computeHeatFromAffect,
    estimateHeatFromQuery,
    classifyGoal,
    getTemporalWindow,
  };
}

// Export for module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    init,
    retrieve,
    computeHeatFromAffect,
    estimateHeatFromQuery,
    classifyGoal,
    getTemporalWindow,
  };
}
