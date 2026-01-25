/**
 * Confidence Scorer for Scout Analysis
 *
 * Calculates confidence levels for detected behavioral patterns based on:
 * - Instance count: More memories matching = higher confidence
 * - Cross-domain bonus: Same pattern in different life areas
 * - Recency weighting: Recent instances boost confidence
 * - Query relevance: How well pattern matches current query
 *
 * NEW: Confidence Calibration Over Time
 * - PatternEvidence records track when patterns fire (support) or are contradicted
 * - Recency decay: old evidence counts less (30d=0.5x, 90d=0.25x)
 * - Contradiction handling: counter-evidence reduces confidence more than supports increase it
 * - DORMANT state: patterns without sufficient recent evidence are not surfaced
 */

// Import config (for module use; inlined in page context)
// const { CONFIDENCE_CONFIG } = require('./confidenceConfig');

// Inline config for standalone use (mirrored from confidenceConfig.js)
const CONFIDENCE_CONFIG = {
  DECAY: {
    RECENT_DAYS: 30,
    STALE_DAYS: 90,
    DORMANT_DAYS: 120,
    RECENT_WEIGHT: 1.0,
    STALE_WEIGHT: 0.5,
    OLD_WEIGHT: 0.25
  },
  CONTRADICTION: {
    RECENT_DAYS: 14,
    STRENGTH_MULTIPLIER: { weak: 1.5, normal: 1.75, strong: 2.0 },
    BASE_PENALTY: 0.15,
    OVERRIDE_REQUIRES_SUPPORTS: 3
  },
  LEVELS: { HIGH: 0.70, MEDIUM: 0.40, LOW: 0.20, DORMANT: 0.10 },
  SCORING: {
    INSTANCE_COUNT: { 1: 0.10, 2: 0.20, 3: 0.30, 4: 0.40 },
    CROSS_DOMAIN: { 2: 0.15, 3: 0.25 },
    QUERY_RELEVANCE: 0.25,
    RECENCY_BONUS: 0.15
  }
};

/**
 * @typedef {Object} ComputedConfidence
 * @property {'HIGH'|'MEDIUM'|'LOW'|'DORMANT'} confidence - Confidence level
 * @property {number} score - Numeric score (0-1)
 * @property {string} rationale - Human-readable explanation
 * @property {Object} debug - Debug fields for transparency
 */

/**
 * Compute pattern confidence with time decay and contradiction handling
 *
 * @param {Array} evidence - All PatternEvidence records for this pattern
 * @param {Date} [now] - Current time (for testing, defaults to new Date())
 * @returns {ComputedConfidence}
 */
function computePatternConfidence(evidence, now = new Date()) {
  // Empty evidence = DORMANT
  if (!evidence || evidence.length === 0) {
    return {
      confidence: 'DORMANT',
      score: 0,
      rationale: 'No evidence recorded for this pattern',
      debug: {
        last_observed: null,
        supports_recent: 0,
        supports_total: 0,
        contradict_recent: 0,
        contradict_total: 0,
        decayed_from: null,
        raw_score: 0
      }
    };
  }

  const nowMs = now.getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const config = CONFIDENCE_CONFIG;

  // Separate evidence by polarity
  const supports = evidence.filter(e => e.polarity === 'support');
  const contradictions = evidence.filter(e => e.polarity === 'contradict');

  // Categorize by recency
  const categorizeByRecency = (items) => {
    const recent = [];    // < 30 days
    const stale = [];     // 30-90 days
    const old = [];       // > 90 days

    for (const item of items) {
      const ageMs = nowMs - new Date(item.observed_at).getTime();
      const ageDays = ageMs / DAY_MS;

      if (ageDays < config.DECAY.RECENT_DAYS) {
        recent.push({ ...item, ageDays });
      } else if (ageDays < config.DECAY.STALE_DAYS) {
        stale.push({ ...item, ageDays });
      } else {
        old.push({ ...item, ageDays });
      }
    }

    return { recent, stale, old };
  };

  const supportCategories = categorizeByRecency(supports);
  const contradictCategories = categorizeByRecency(contradictions);

  // Calculate weighted support score
  const weightedSupports =
    supportCategories.recent.length * config.DECAY.RECENT_WEIGHT +
    supportCategories.stale.length * config.DECAY.STALE_WEIGHT +
    supportCategories.old.length * config.DECAY.OLD_WEIGHT;

  // Base score from weighted instance count
  let rawScore = 0;
  const scoring = config.SCORING.INSTANCE_COUNT;
  if (weightedSupports >= 4) rawScore += scoring[4];
  else if (weightedSupports >= 3) rawScore += scoring[3];
  else if (weightedSupports >= 2) rawScore += scoring[2];
  else if (weightedSupports >= 1) rawScore += scoring[1];

  // Cross-domain bonus (from all supports, not just recent)
  const domains = new Set(supports.map(s => s.domain).filter(Boolean));
  if (domains.size >= 3) {
    rawScore += config.SCORING.CROSS_DOMAIN[3];
  } else if (domains.size >= 2) {
    rawScore += config.SCORING.CROSS_DOMAIN[2];
  }

  // Recency bonus (recent supports exist)
  if (supportCategories.recent.length >= 2) {
    rawScore += config.SCORING.RECENCY_BONUS;
  } else if (supportCategories.recent.length >= 1) {
    rawScore += config.SCORING.RECENCY_BONUS * 0.5;
  }

  // Find most recent evidence for debug
  const lastObserved = evidence.reduce((latest, e) => {
    const eDate = new Date(e.observed_at);
    return !latest || eDate > latest ? eDate : latest;
  }, null);

  // Initialize debug info
  const debug = {
    last_observed: lastObserved ? lastObserved.toISOString() : null,
    supports_recent: supportCategories.recent.length,
    supports_total: supports.length,
    contradict_recent: contradictCategories.recent.length,
    contradict_total: contradictions.length,
    decayed_from: null,
    raw_score: Math.round(rawScore * 100) / 100
  };

  let score = rawScore;
  const rationale = [];

  // Apply contradiction penalties
  for (const c of contradictions) {
    const ageMs = nowMs - new Date(c.observed_at).getTime();
    const ageDays = ageMs / DAY_MS;

    // Base multiplier from strength
    let multiplier = config.CONTRADICTION.STRENGTH_MULTIPLIER[c.strength] || config.CONTRADICTION.STRENGTH_MULTIPLIER.normal;

    // Recent contradictions hit harder
    if (ageDays < config.DECAY.RECENT_DAYS) {
      multiplier *= 1.2;
    } else if (ageDays < config.DECAY.STALE_DAYS) {
      multiplier *= 0.8;
    } else {
      multiplier *= 0.5;
    }

    // Subtract weighted contradiction penalty
    const penalty = config.CONTRADICTION.BASE_PENALTY * multiplier;
    score -= penalty;
  }

  // Ensure score doesn't go negative
  score = Math.max(0, score);

  // Determine initial confidence level
  let confidence;
  const levels = config.LEVELS;

  if (score >= levels.HIGH) {
    confidence = 'HIGH';
    rationale.push(`Strong evidence (${supports.length} supports, ${domains.size} domain${domains.size !== 1 ? 's' : ''})`);
  } else if (score >= levels.MEDIUM) {
    confidence = 'MEDIUM';
    rationale.push(`Moderate evidence (${supports.length} supports)`);
  } else if (score >= levels.LOW) {
    confidence = 'LOW';
    rationale.push(`Weak evidence (${supports.length} supports)`);
  } else {
    confidence = 'DORMANT';
    rationale.push('Insufficient evidence');
  }

  // Rule: 120+ days since last support with no recent supports = max MEDIUM
  const mostRecentSupport = supports.reduce((latest, s) => {
    const sDate = new Date(s.observed_at);
    return !latest || sDate > latest ? sDate : latest;
  }, null);

  if (mostRecentSupport) {
    const daysSinceSupport = (nowMs - mostRecentSupport.getTime()) / DAY_MS;

    if (daysSinceSupport >= config.DECAY.DORMANT_DAYS && supportCategories.recent.length === 0) {
      if (confidence === 'HIGH') {
        debug.decayed_from = 'HIGH';
        confidence = 'MEDIUM';
        rationale.push(`Decayed: ${Math.round(daysSinceSupport)} days since last support`);
      }
    }
  }

  // Rule: Recent strong contradiction = max MEDIUM unless 3+ recent strong supports override
  const recentStrongContradictions = contradictCategories.recent.filter(c => c.strength === 'strong');
  const recentStrongSupports = supportCategories.recent.filter(s => s.strength === 'strong');

  if (recentStrongContradictions.length > 0) {
    if (recentStrongSupports.length < config.CONTRADICTION.OVERRIDE_REQUIRES_SUPPORTS) {
      if (confidence === 'HIGH') {
        debug.decayed_from = debug.decayed_from || 'HIGH';
        confidence = 'MEDIUM';
        rationale.push(`Capped: ${recentStrongContradictions.length} recent strong contradiction${recentStrongContradictions.length !== 1 ? 's' : ''}`);
      }
    } else {
      rationale.push(`Override: ${recentStrongSupports.length} recent strong supports counteract contradiction`);
    }
  }

  // Add contradiction note to rationale if any exist
  if (contradictions.length > 0 && !rationale.some(r => r.includes('contradiction'))) {
    rationale.push(`${contradictions.length} contradiction${contradictions.length !== 1 ? 's' : ''} on record`);
  }

  return {
    confidence,
    score: Math.round(score * 100) / 100,
    rationale: rationale.join('; '),
    debug
  };
}

/**
 * Calculate confidence score for a behavioral pattern (LEGACY - backward compatible)
 * @param {Array} instances - Array of memory instances matching this pattern
 * @param {number} queryRelevance - 0-1 score of how relevant pattern is to current query
 * @returns {{level: 'HIGH'|'MEDIUM'|'LOW', score: number}}
 */
function calculateConfidence(instances, queryRelevance) {
  if (!instances || instances.length === 0) {
    return { level: 'LOW', score: 0 };
  }

  let score = 0;

  // Instance count contribution (0.05 - 0.35)
  if (instances.length >= 4) {
    score += 0.35;
  } else if (instances.length >= 3) {
    score += 0.25;
  } else if (instances.length >= 2) {
    score += 0.15;
  } else {
    score += 0.05;
  }

  // Cross-domain bonus (0 - 0.25)
  const domains = new Set(instances.map(i => i.domain).filter(Boolean));
  if (domains.size >= 3) {
    score += 0.25;
  } else if (domains.size >= 2) {
    score += 0.15;
  }

  // Recency weighting (0 - 0.15)
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const recentInstances = instances.filter(i => {
    if (!i.createdAt && !i.updatedAt) return false;
    const memoryDate = new Date(i.createdAt || i.updatedAt).getTime();
    return (now - memoryDate) < THIRTY_DAYS_MS;
  });

  if (recentInstances.length >= 2) {
    score += 0.15;
  } else if (recentInstances.length >= 1) {
    score += 0.08;
  }

  // Query relevance contribution (0 - 0.25)
  score += (queryRelevance || 0) * 0.25;

  // Map score to confidence level
  let level;
  if (score >= 0.70) {
    level = 'HIGH';
  } else if (score >= 0.40) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  return {
    level,
    score: Math.round(score * 100) / 100
  };
}

/**
 * Calculate recency in days for a memory
 * @param {Object} memory - Memory object with createdAt/updatedAt
 * @returns {number} Days since memory was created/updated
 */
function calculateRecencyDays(memory) {
  if (!memory) return Infinity;

  const dateStr = memory.createdAt || memory.updatedAt;
  if (!dateStr) return Infinity;

  const memoryDate = new Date(dateStr).getTime();
  const now = Date.now();
  const daysSince = (now - memoryDate) / (24 * 60 * 60 * 1000);

  return Math.round(daysSince);
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIDENCE_CONFIG,
    computePatternConfidence,
    calculateConfidence,
    calculateRecencyDays
  };
}
