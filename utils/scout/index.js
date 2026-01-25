/**
 * Scout Module - Pattern extraction and confidence assessment
 *
 * The Scout analyzes retrieved memories for behavioral verb patterns
 * (how the user does things, not what they've done) and passes
 * confidence-tagged insights to the Judge.
 *
 * Note: In page context (fetch-interceptor.js), these functions are
 * inlined since module imports are not available. This module exists
 * for organization, testing, and documentation purposes.
 */

const { BEHAVIORAL_VERB_PATTERNS, detectPatternsInMemory, queryMatchesBridges } = require('./behavioralVerbs');
const { calculateConfidence, calculateRecencyDays } = require('./confidenceScorer');
const { analyzeWithScout } = require('./scoutAnalyzer');

module.exports = {
  // Pattern detection
  BEHAVIORAL_VERB_PATTERNS,
  detectPatternsInMemory,
  queryMatchesBridges,

  // Confidence scoring
  calculateConfidence,
  calculateRecencyDays,

  // Main analyzer
  analyzeWithScout
};
