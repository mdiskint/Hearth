/**
 * Scout Module - Pattern extraction and confidence assessment
 *
 * The Scout analyzes retrieved memories for behavioral verb patterns
 * (how the user does things, not what they've done) and passes
 * confidence-tagged insights to the Judge.
 *
 * Confidence Calibration Over Time:
 * - PatternEvidence records track when patterns fire (support) or are contradicted
 * - Recency decay: old evidence counts less (30d=0.5x, 90d=0.25x)
 * - Contradiction handling: counter-evidence reduces confidence more than supports increase it
 * - DORMANT state: patterns without sufficient recent evidence are not surfaced
 *
 * Note: In page context (fetch-interceptor.js), these functions are
 * inlined since module imports are not available. This module exists
 * for organization, testing, and documentation purposes.
 */

const { CONFIDENCE_CONFIG, TimeUtils } = require('./confidenceConfig');
const { BEHAVIORAL_VERB_PATTERNS, detectPatternsInMemory, queryMatchesBridges, detectContradictions, messageContradictsPattern } = require('./behavioralVerbs');
const { computePatternConfidence, calculateConfidence, calculateRecencyDays } = require('./confidenceScorer');
const { analyzeWithScout } = require('./scoutAnalyzer');
const {
  createSupportEvidence,
  createContradictEvidence,
  loadPatternEvidence,
  loadAllEvidence,
  appendEvidence,
  appendEvidenceBatch,
  determineStrength,
  clearPatternEvidence,
  clearAllEvidence
} = require('./evidenceStore');

module.exports = {
  // Configuration
  CONFIDENCE_CONFIG,
  TimeUtils,

  // Pattern detection
  BEHAVIORAL_VERB_PATTERNS,
  detectPatternsInMemory,
  queryMatchesBridges,
  detectContradictions,
  messageContradictsPattern,

  // Confidence scoring (legacy + new)
  calculateConfidence,
  calculateRecencyDays,
  computePatternConfidence,

  // Evidence store
  createSupportEvidence,
  createContradictEvidence,
  loadPatternEvidence,
  loadAllEvidence,
  appendEvidence,
  appendEvidenceBatch,
  determineStrength,
  clearPatternEvidence,
  clearAllEvidence,

  // Main analyzer
  analyzeWithScout
};

// V2 - Goal-dependent inhibition
const { analyzeWithScoutV2, quickFilter, extractGoal } = require('./scoutAnalyzerV2');

module.exports.analyzeWithScoutV2 = analyzeWithScoutV2;
module.exports.quickFilter = quickFilter;
module.exports.extractGoal = extractGoal;

