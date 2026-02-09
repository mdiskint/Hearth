/**
 * Surprise Cache - Caches KL divergence scores for Stage 2 re-ranking
 *
 * Avoids recomputing expensive logprobs calls when the same memory is
 * evaluated against similar conversation context.
 *
 * Cache key: memory_id + hash of context (last user message)
 * TTL: 5 minutes
 * Invalidation: When synthesis detection fires (memory content may have changed)
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache: Map<string, { score: number, timestamp: number }>
const cache = new Map();

/**
 * Generate a simple hash from a string.
 * Used to create a compact key from the user's message.
 *
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashString(str) {
  if (!str) return '0';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Build a cache key from memory ID and context hash.
 *
 * @param {string} memoryId - Memory UUID
 * @param {string} contextHash - Hash of conversation context
 * @returns {string} Cache key
 */
function buildKey(memoryId, contextHash) {
  return `${memoryId}:${contextHash}`;
}

/**
 * Get a cached KL divergence score.
 *
 * @param {string} memoryId - Memory UUID
 * @param {string} contextHash - Hash of conversation context (use hashContext())
 * @returns {number|null} Cached score or null if not found/expired
 */
function getCache(memoryId, contextHash) {
  const key = buildKey(memoryId, contextHash);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // Check TTL
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.score;
}

/**
 * Store a KL divergence score in the cache.
 *
 * @param {string} memoryId - Memory UUID
 * @param {string} contextHash - Hash of conversation context
 * @param {number} klScore - The computed KL divergence score
 */
function setCache(memoryId, contextHash, klScore) {
  const key = buildKey(memoryId, contextHash);
  cache.set(key, {
    score: klScore,
    timestamp: Date.now()
  });

  // Periodic cleanup: remove expired entries if cache is getting large
  if (cache.size > 100) {
    cleanupExpired();
  }
}

/**
 * Invalidate all cached scores.
 * Called when synthesis detection fires (memory content may have changed).
 */
function invalidateAll() {
  cache.clear();
  console.log('Hearth: Surprise cache invalidated');
}

/**
 * Remove expired entries from the cache.
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

/**
 * Hash the conversation context for cache key generation.
 * Uses the user's last message as the context signal.
 *
 * @param {string} userMessage - The user's message
 * @returns {string} Context hash
 */
function hashContext(userMessage) {
  return hashString(userMessage);
}

/**
 * Get cache statistics for debugging.
 *
 * @returns {{ size: number, oldestAge: number|null }}
 */
function getStats() {
  if (cache.size === 0) {
    return { size: 0, oldestAge: null };
  }

  const now = Date.now();
  let oldestAge = 0;

  for (const entry of cache.values()) {
    const age = now - entry.timestamp;
    if (age > oldestAge) {
      oldestAge = age;
    }
  }

  return {
    size: cache.size,
    oldestAge: Math.round(oldestAge / 1000) // in seconds
  };
}

// ============================================================
// Cross-context invalidation listener
// ============================================================

// Listen for invalidation events from content script (storage.js)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'HEARTH_INVALIDATE_SURPRISE_CACHE') {
      invalidateAll();
    }
  });
}

// ============================================================
// Exports
// ============================================================

// Browser export
if (typeof window !== 'undefined') {
  window.HearthSurpriseCache = {
    getCache,
    setCache,
    invalidateAll,
    hashContext,
    getStats
  };
}

// Node/CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getCache,
    setCache,
    invalidateAll,
    hashContext,
    getStats
  };
}
