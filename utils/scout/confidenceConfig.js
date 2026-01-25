/**
 * Confidence Calibration Configuration
 *
 * All thresholds and weights for confidence scoring in one place.
 * Confidence is a revocable license; decays without refresh; counter-evidence downgrades.
 */

const CONFIDENCE_CONFIG = {
  // Time decay thresholds (in days)
  DECAY: {
    RECENT_DAYS: 30,           // Evidence younger than this gets full weight
    STALE_DAYS: 90,            // Evidence older than this gets quarter weight
    DORMANT_DAYS: 120,         // No supports newer than this = max MEDIUM

    RECENT_WEIGHT: 1.0,        // Weight for evidence < 30 days
    STALE_WEIGHT: 0.5,         // Weight for evidence 30-90 days
    OLD_WEIGHT: 0.25           // Weight for evidence > 90 days
  },

  // Contradiction handling
  CONTRADICTION: {
    RECENT_DAYS: 14,           // "Recent" contradiction threshold
    STRENGTH_MULTIPLIER: {
      weak: 1.5,
      normal: 1.75,
      strong: 2.0
    },
    BASE_PENALTY: 0.15,        // Base penalty per contradiction
    OVERRIDE_REQUIRES_SUPPORTS: 3  // Need 3+ recent strong supports to override recent strong contradiction
  },

  // Confidence level thresholds
  LEVELS: {
    HIGH: 0.70,
    MEDIUM: 0.40,
    LOW: 0.20,
    DORMANT: 0.10
  },

  // Base scoring weights (sum to ~1.0 for max score)
  SCORING: {
    INSTANCE_COUNT: {
      1: 0.10,
      2: 0.20,
      3: 0.30,
      4: 0.40    // 4+ instances
    },
    CROSS_DOMAIN: {
      2: 0.15,
      3: 0.25    // 3+ domains
    },
    QUERY_RELEVANCE: 0.25,
    RECENCY_BONUS: 0.15
  },

  // Evidence pruning (to prevent unbounded growth)
  PRUNING: {
    MAX_EVIDENCE_PER_PATTERN: 100,  // Keep at most 100 evidence records per pattern
    MAX_AGE_DAYS: 365               // Prune evidence older than 1 year
  }
};

// Time utilities for testing - allows mocking current time
const TimeUtils = {
  _mockNow: null,

  now() {
    return this._mockNow ? new Date(this._mockNow) : new Date();
  },

  nowMs() {
    return this._mockNow ? new Date(this._mockNow).getTime() : Date.now();
  },

  setMockNow(dateOrString) {
    this._mockNow = dateOrString;
  },

  clearMock() {
    this._mockNow = null;
  }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIDENCE_CONFIG,
    TimeUtils
  };
}
