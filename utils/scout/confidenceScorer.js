/**
 * Confidence Scorer for Scout Analysis
 *
 * Calculates confidence levels for detected behavioral patterns based on:
 * - Instance count: More memories matching = higher confidence
 * - Cross-domain bonus: Same pattern in different life areas
 * - Recency weighting: Recent instances boost confidence
 * - Query relevance: How well pattern matches current query
 */

/**
 * Calculate confidence score for a behavioral pattern
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
    calculateConfidence,
    calculateRecencyDays
  };
}
