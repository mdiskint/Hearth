/**
 * PatternEvidence Storage Functions
 *
 * Handles persistence and retrieval of pattern evidence records.
 * Evidence tracks when patterns fire (support) or are contradicted,
 * enabling confidence calibration over time.
 */

// Import config (for module use; inlined in page context)
// const { CONFIDENCE_CONFIG } = require('./confidenceConfig');

/**
 * @typedef {Object} PatternEvidence
 * @property {string} id - Unique ID (pattern_id + timestamp)
 * @property {string} pattern_id - e.g., 'decision_spiral', 'momentum_through_building'
 * @property {string|null} domain - Life domain where observed (Work, Relationships, etc.)
 * @property {string} observed_at - ISO 8601 timestamp
 * @property {'support'|'contradict'} polarity - Whether this supports or contradicts the pattern
 * @property {'weak'|'normal'|'strong'} strength - Evidence strength
 * @property {string} [source_memory_id] - Optional: memory ID that triggered this evidence
 * @property {string} [source_query] - Optional: truncated query that triggered this (for debugging)
 */

/**
 * Create a support evidence record
 * @param {string} patternId - Pattern identifier
 * @param {string|null} domain - Life domain (Work, Relationships, etc.)
 * @param {'weak'|'normal'|'strong'} strength - Evidence strength
 * @param {Object} metadata - Optional: source_memory_id, source_query
 * @returns {PatternEvidence}
 */
function createSupportEvidence(patternId, domain = null, strength = 'normal', metadata = {}) {
  const now = Date.now();
  return {
    id: `${patternId}_support_${now}`,
    pattern_id: patternId,
    domain: domain,
    observed_at: new Date(now).toISOString(),
    polarity: 'support',
    strength: strength,
    source_memory_id: metadata.source_memory_id || null,
    source_query: metadata.source_query ? metadata.source_query.substring(0, 100) : null
  };
}

/**
 * Create a contradiction evidence record
 * @param {string} patternId - Pattern identifier
 * @param {string|null} domain - Life domain (Work, Relationships, etc.)
 * @param {'weak'|'normal'|'strong'} strength - Evidence strength
 * @param {Object} metadata - Optional: source_memory_id, source_query
 * @returns {PatternEvidence}
 */
function createContradictEvidence(patternId, domain = null, strength = 'normal', metadata = {}) {
  const now = Date.now();
  return {
    id: `${patternId}_contradict_${now}`,
    pattern_id: patternId,
    domain: domain,
    observed_at: new Date(now).toISOString(),
    polarity: 'contradict',
    strength: strength,
    source_memory_id: metadata.source_memory_id || null,
    source_query: metadata.source_query ? metadata.source_query.substring(0, 100) : null
  };
}

/**
 * Load all evidence for a specific pattern from chrome.storage
 * @param {string} patternId - Pattern identifier
 * @returns {Promise<PatternEvidence[]>}
 */
async function loadPatternEvidence(patternId) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('chrome.storage not available');
    return [];
  }

  try {
    const data = await chrome.storage.local.get('patternEvidence');
    const allEvidence = data.patternEvidence || {};
    return allEvidence[patternId] || [];
  } catch (error) {
    console.error('Failed to load pattern evidence:', error);
    return [];
  }
}

/**
 * Load all evidence (all patterns) from chrome.storage
 * @returns {Promise<Object>} Map of pattern_id -> evidence[]
 */
async function loadAllEvidence() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('chrome.storage not available');
    return {};
  }

  try {
    const data = await chrome.storage.local.get('patternEvidence');
    return data.patternEvidence || {};
  } catch (error) {
    console.error('Failed to load all evidence:', error);
    return {};
  }
}

/**
 * Append new evidence record to chrome.storage
 * @param {PatternEvidence} evidence - Evidence record to store
 * @param {number} maxPerPattern - Maximum evidence records per pattern (pruning)
 * @returns {Promise<void>}
 */
async function appendEvidence(evidence, maxPerPattern = 100) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('chrome.storage not available, evidence not persisted');
    return;
  }

  try {
    const data = await chrome.storage.local.get('patternEvidence');
    const allEvidence = data.patternEvidence || {};

    if (!allEvidence[evidence.pattern_id]) {
      allEvidence[evidence.pattern_id] = [];
    }

    // Add unique ID if not present
    if (!evidence.id) {
      evidence.id = `${evidence.pattern_id}_${evidence.polarity}_${Date.now()}`;
    }

    // Set timestamp if not present
    if (!evidence.observed_at) {
      evidence.observed_at = new Date().toISOString();
    }

    allEvidence[evidence.pattern_id].push(evidence);

    // Prune if over limit: keep most recent
    if (allEvidence[evidence.pattern_id].length > maxPerPattern) {
      allEvidence[evidence.pattern_id] = allEvidence[evidence.pattern_id]
        .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))
        .slice(0, maxPerPattern);
    }

    await chrome.storage.local.set({ patternEvidence: allEvidence });
  } catch (error) {
    console.error('Failed to append evidence:', error);
  }
}

/**
 * Append multiple evidence records at once (batch operation)
 * @param {PatternEvidence[]} evidenceArray - Array of evidence records
 * @param {number} maxPerPattern - Maximum evidence records per pattern
 * @returns {Promise<void>}
 */
async function appendEvidenceBatch(evidenceArray, maxPerPattern = 100) {
  if (!evidenceArray || evidenceArray.length === 0) return;

  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn('chrome.storage not available, evidence not persisted');
    return;
  }

  try {
    const data = await chrome.storage.local.get('patternEvidence');
    const allEvidence = data.patternEvidence || {};

    for (const evidence of evidenceArray) {
      if (!allEvidence[evidence.pattern_id]) {
        allEvidence[evidence.pattern_id] = [];
      }

      // Add unique ID if not present
      if (!evidence.id) {
        evidence.id = `${evidence.pattern_id}_${evidence.polarity}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      }

      // Set timestamp if not present
      if (!evidence.observed_at) {
        evidence.observed_at = new Date().toISOString();
      }

      allEvidence[evidence.pattern_id].push(evidence);
    }

    // Prune all patterns that exceed limit
    for (const patternId of Object.keys(allEvidence)) {
      if (allEvidence[patternId].length > maxPerPattern) {
        allEvidence[patternId] = allEvidence[patternId]
          .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))
          .slice(0, maxPerPattern);
      }
    }

    await chrome.storage.local.set({ patternEvidence: allEvidence });
  } catch (error) {
    console.error('Failed to append evidence batch:', error);
  }
}

/**
 * Determine evidence strength based on instance count
 * @param {number} instanceCount - Number of matching instances
 * @returns {'weak'|'normal'|'strong'}
 */
function determineStrength(instanceCount) {
  if (instanceCount >= 3) return 'strong';
  if (instanceCount >= 2) return 'normal';
  return 'weak';
}

/**
 * Clear all evidence for a pattern (for testing)
 * @param {string} patternId - Pattern identifier
 * @returns {Promise<void>}
 */
async function clearPatternEvidence(patternId) {
  if (typeof chrome === 'undefined' || !chrome.storage) return;

  try {
    const data = await chrome.storage.local.get('patternEvidence');
    const allEvidence = data.patternEvidence || {};
    delete allEvidence[patternId];
    await chrome.storage.local.set({ patternEvidence: allEvidence });
  } catch (error) {
    console.error('Failed to clear pattern evidence:', error);
  }
}

/**
 * Clear all evidence (for testing)
 * @returns {Promise<void>}
 */
async function clearAllEvidence() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;

  try {
    await chrome.storage.local.set({ patternEvidence: {} });
  } catch (error) {
    console.error('Failed to clear all evidence:', error);
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSupportEvidence,
    createContradictEvidence,
    loadPatternEvidence,
    loadAllEvidence,
    appendEvidence,
    appendEvidenceBatch,
    determineStrength,
    clearPatternEvidence,
    clearAllEvidence
  };
}
