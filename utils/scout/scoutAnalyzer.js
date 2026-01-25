/**
 * Scout Analyzer - Main analysis engine
 *
 * Analyzes retrieved memories for behavioral verb patterns and
 * calculates confidence scores for passing to the Judge.
 */

// Import dependencies (for module use; inlined in page context)
// const { COMPILED_PATTERNS, detectPatternsInMemory, queryMatchesBridges } = require('./behavioralVerbs');
// const { calculateConfidence, calculateRecencyDays } = require('./confidenceScorer');

/**
 * Main Scout analysis function
 * @param {Array} memories - Retrieved memories to analyze
 * @param {string} queryMessage - Current user query
 * @returns {Array} Top 3 most relevant patterns with confidence
 */
function analyzeWithScout(memories, queryMessage) {
  if (!memories || memories.length === 0) {
    return [];
  }

  // Step 1: Detect patterns in all memories
  const patternMatches = {}; // patternId -> { instances: [], domains: Set }

  for (const memory of memories) {
    const content = memory.content || '';
    const detected = detectPatternsInMemory(content);

    for (const match of detected) {
      if (!patternMatches[match.patternId]) {
        patternMatches[match.patternId] = {
          patternId: match.patternId,
          verb: match.verb,
          application: match.application,
          instances: [],
          domains: new Set()
        };
      }

      // Add instance with metadata
      patternMatches[match.patternId].instances.push({
        content: content,
        domain: memory.domain,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        recencyDays: calculateRecencyDays(memory)
      });

      if (memory.domain) {
        patternMatches[match.patternId].domains.add(memory.domain);
      }
    }
  }

  // Step 2: Calculate confidence for each pattern
  const scoredPatterns = [];

  for (const [patternId, data] of Object.entries(patternMatches)) {
    // Check query relevance
    const queryRelevant = queryMatchesBridges(queryMessage, patternId);
    const queryRelevance = queryRelevant ? 1.0 : 0.0;

    // Calculate confidence
    const confidence = calculateConfidence(data.instances, queryRelevance);

    scoredPatterns.push({
      patternId,
      verb: data.verb,
      application: data.application,
      domains: Array.from(data.domains),
      instanceCount: data.instances.length,
      confidence: confidence,
      queryRelevant
    });
  }

  // Step 3: Filter to query-relevant patterns only (unless none match)
  let relevantPatterns = scoredPatterns.filter(p => p.queryRelevant);

  // If no patterns match query bridges, fall back to highest-confidence patterns
  if (relevantPatterns.length === 0) {
    relevantPatterns = scoredPatterns;
  }

  // Step 4: Sort by confidence score (highest first)
  relevantPatterns.sort((a, b) => b.confidence.score - a.confidence.score);

  // Step 5: Return top 3 patterns
  const topPatterns = relevantPatterns.slice(0, 3);

  // Only return patterns with meaningful confidence
  return topPatterns.filter(p => p.confidence.level !== 'LOW' || p.instanceCount >= 2);
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    analyzeWithScout
  };
}
