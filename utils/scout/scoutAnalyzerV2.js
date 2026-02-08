/**
 * Scout Analyzer V2 - Extended with Goal-Dependent Inhibition
 * 
 * This is the upgraded Scout that acts as the "prefrontal cortex":
 * 1. Extracts the user's current goal from query + context
 * 2. Filters memories by goal relevance (inhibition)
 * 3. Analyzes filtered memories for behavioral patterns
 * 4. Returns both filtered memories AND pattern insights
 * 
 * The key insight from cognitive science: retrieval and inhibition
 * happen together, not sequentially. This module integrates them.
 */


/**
 * Behavioral verb patterns - same as original Scout
 * (Preserved for compatibility, would normally import from behavioralVerbs.js)
 */
const COMPILED_PATTERNS = {
  decision_spiral: {
    patterns: [
      /spiral(ing|ed|s)?\s*(by|via|through)?\s*(collect|gather|accumul)/i,
      /too many (options|choices|possibilities)/i,
      /can't (narrow|choose|pick|decide)/i,
      /keep adding (more|options|alternatives)/i,
      /analysis paralysis/i,
      /endless (research|comparison|options)/i,
      /overwhelmed by (choice|options|possibilities)/i,
      /stuck in (options|decision|choosing)/i,
      /comparing (everything|endlessly|forever)/i,
      /option (overload|paralysis|fatigue)/i
    ],
    verb: 'spirals via option-accumulation',
    application: 'needs constraint to decide',
    queryBridges: [/should I/i, /which (one|option)/i, /decide/i, /choose/i, /pick/i],
    contradictionBridges: [/I('ve)? decided/i, /made (my|a) (choice|decision)/i]
  },
  avoidance_loop: {
    patterns: [
      /avoid(ing|ed|s)?\s*(the|this|that)?\s*(hard|difficult|uncomfortable)/i,
      /put(ting)?\s*off/i,
      /procrastinat/i,
      /keep (not|avoiding|delaying)/i,
      /haven't (started|done|addressed)/i,
      /been meaning to/i,
      /should (have|be) (done|doing)/i
    ],
    verb: 'avoids via delay/distraction',
    application: 'needs acknowledgment then smallest step',
    queryBridges: [/how do I (start|begin)/i, /I keep/i, /can't seem to/i],
    contradictionBridges: [/finally (did|started|finished)/i, /I (did|completed|finished)/i]
  },
  perfectionism_block: {
    patterns: [
      /perfect(ion|ionism|ionist)/i,
      /not good enough/i,
      /has to be (perfect|right|exactly)/i,
      /can't (ship|publish|share|release) until/i,
      /what if (people|they|someone) (think|judge|criticize)/i,
      /one more (thing|pass|revision)/i
    ],
    verb: 'blocks via perfectionism',
    application: 'needs permission to ship imperfect',
    queryBridges: [/is this good/i, /ready to/i, /should I (share|publish|ship)/i],
    contradictionBridges: [/shipped/i, /published/i, /released/i, /good enough/i]
  },
  external_validation: {
    patterns: [
      /what (do|would) (you|they|people|others) think/i,
      /need (approval|validation|permission)/i,
      /is (this|it) (ok|okay|right|acceptable)/i,
      /will (they|people) (like|accept|approve)/i,
      /worried about (judgment|criticism|what people)/i
    ],
    verb: 'seeks external validation',
    application: 'redirect to internal compass',
    queryBridges: [/what do you think/i, /is this (ok|good|right)/i, /validate/i],
    contradictionBridges: [/I (know|decided|believe)/i, /doesn't matter what/i]
  },
  scope_creep: {
    patterns: [
      /keep (adding|expanding|growing)/i,
      /one more (feature|thing|idea)/i,
      /scope (creep|expansion|growth)/i,
      /getting (bigger|larger|more complex)/i,
      /while I'm at it/i,
      /might as well/i
    ],
    verb: 'expands via scope creep',
    application: 'needs scope constraint',
    queryBridges: [/should I (also|add)/i, /what about/i, /while/i],
    contradictionBridges: [/keeping it (simple|small)/i, /minimum viable/i, /MVP/i]
  }
};

/**
 * Detect patterns in a single memory's content
 * (Preserved from original Scout)
 */
function detectPatternsInMemory(content) {
  const matches = [];
  
  for (const [patternId, patternDef] of Object.entries(COMPILED_PATTERNS)) {
    for (const regex of patternDef.patterns) {
      if (regex.test(content)) {
        matches.push({
          patternId,
          verb: patternDef.verb,
          application: patternDef.application
        });
        break; // One match per pattern is enough
      }
    }
  }
  
  return matches;
}

/**
 * Check if query matches pattern bridges
 * (Preserved from original Scout)
 */
function queryMatchesBridges(query, patternId) {
  const patternDef = COMPILED_PATTERNS[patternId];
  if (!patternDef || !patternDef.queryBridges) return false;
  
  for (const bridge of patternDef.queryBridges) {
    if (bridge.test(query)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a message contradicts a pattern
 */
function messageContradictsPattern(message, patternId) {
  const patternDef = COMPILED_PATTERNS[patternId];
  if (!patternDef || !patternDef.contradictionBridges) return false;
  
  for (const bridge of patternDef.contradictionBridges) {
    if (bridge.test(message)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate confidence score for a pattern
 * (Simplified from original - would integrate with confidenceScorer.js)
 */
function calculateConfidence(instances, queryRelevance) {
  const baseConfidence = Math.min(instances.length * 0.2, 0.8);
  const relevanceBoost = queryRelevance * 0.2;
  return Math.min(baseConfidence + relevanceBoost, 1.0);
}

/**
 * Main Scout V2 Analysis Function
 * 
 * This is the key function that integrates:
 * 1. Goal extraction
 * 2. Memory inhibition
 * 3. Pattern analysis
 * 
 * @param {Array} memories - Retrieved memories (pre-filtered by semantic/heat)
 * @param {string} queryMessage - Current user message
 * @param {Array} conversationContext - Recent turns [{role, content}, ...]
 * @param {Object} options - Analysis options
 * @returns {Object} Complete analysis with filtered memories and patterns
 */
function analyzeWithScoutV2(memories, queryMessage, conversationContext = [], options = {}) {
  const {
    minRelevanceScore = 0.3,
    maxMemories = 3,
    includeInhibitionReport = false,
    preserveHighHeat = true
  } = options;
  
  // Handle empty input
  if (!memories || memories.length === 0) {
    return {
      goal: null,
      filteredMemories: [],
      inhibitedCount: 0,
      patterns: [],
      inhibitionReport: null
    };
  }
  
  // Step 1: Extract the current goal
  // Use window object in browser context, or imported function in Node
  const extractGoalFn = (typeof window !== 'undefined' && window.HearthGoalExtractor)
    ? window.HearthGoalExtractor.extractGoal
    : extractGoal;
  
  if (!extractGoalFn) {
    throw new Error('extractGoal function not available');
  }
  
  const goal = extractGoalFn(queryMessage, conversationContext);

  // If goal is unclear or low confidence, pass through semantic results without goal-based filtering
  // This is "fail-open for retrieval" - we trust the semantic search, just skip goal-based inhibition
  if (goal.type === 'UNCLEAR' || goal.confidence < 0.3) {
    // Take top memories by resonance score (from semantic search) or just first N
    const passedMemories = memories.slice(0, maxMemories).map(m => ({
      id: m.id,
      content: m.content,
      heat: m.heat || m.intensity,
      relevanceScore: m.resonance || m.similarity || null,
      domains: []
    }));
    
    return {
      goal: {
        type: goal.type,
        id: goal.id,
        label: goal.label,
        description: goal.description,
        confidence: goal.confidence
      },
      filteredMemories: passedMemories,
      inhibitedCount: Math.max(0, memories.length - maxMemories),
      stats: { total: memories.length, kept: passedMemories.length, inhibited: Math.max(0, memories.length - maxMemories) },
      patterns: [],
      inhibitionReport: null
    };
  }

  // Step 2: Filter memories by goal relevance (INHIBITION)
  const filterMemoriesFn = (typeof window !== 'undefined' && window.HearthMemoryFilter)
    ? window.HearthMemoryFilter.filterMemoriesByGoal
    : filterMemoriesByGoal;
  
  if (!filterMemoriesFn) {
    throw new Error('filterMemoriesByGoal function not available');
  }
  
  const filterResult = filterMemoriesFn(memories, goal, queryMessage, {
    minRelevanceScore,
    maxMemories,
    includeInhibited: includeInhibitionReport,
    preserveHighHeat
  });
  
  const filteredMemories = filterResult.filtered;
  
  // Step 3: Analyze filtered memories for behavioral patterns
  // (Only analyze what survived inhibition)
  const patternMatches = {}; // patternId -> { instances: [], domains: Set }
  
  for (const memory of filteredMemories) {
    const content = memory.content || '';
    const detected = detectPatternsInMemory(content);
    
    for (const match of detected) {
      if (!patternMatches[match.patternId]) {
        patternMatches[match.patternId] = {
          instances: [],
          domains: new Set()
        };
      }
      
      patternMatches[match.patternId].instances.push({
        memoryId: memory.id,
        content: content.substring(0, 100)
      });
      
      // Track domains from the memory
      if (memory.goalRelevance && memory.goalRelevance.domains) {
        for (const d of memory.goalRelevance.domains) {
          patternMatches[match.patternId].domains.add(d);
        }
      }
    }
  }
  
  // Step 4: Score and filter patterns
  const scoredPatterns = [];
  
  for (const [patternId, data] of Object.entries(patternMatches)) {
    const patternDef = COMPILED_PATTERNS[patternId];
    const queryRelevant = queryMatchesBridges(queryMessage, patternId);
    const queryRelevance = queryRelevant ? 1.0 : 0.0;
    
    const confidence = calculateConfidence(data.instances, queryRelevance);
    
    scoredPatterns.push({
      patternId,
      verb: patternDef.verb,
      application: patternDef.application,
      domains: Array.from(data.domains),
      instanceCount: data.instances.length,
      confidence: {
        score: confidence,
        level: confidence > 0.7 ? 'HIGH' : confidence > 0.4 ? 'MEDIUM' : 'LOW'
      },
      queryRelevant,
      instances: data.instances.slice(0, 3) // Include sample instances
    });
  }
  
  // Filter to query-relevant patterns if any exist
  let relevantPatterns = scoredPatterns.filter(p => p.queryRelevant);
  if (relevantPatterns.length === 0) {
    relevantPatterns = scoredPatterns;
  }
  
  // Sort by confidence
  relevantPatterns.sort((a, b) => b.confidence.score - a.confidence.score);
  
  // Take top 3
  const topPatterns = relevantPatterns.slice(0, 3);
  
  // Generate inhibition report if requested
  let inhibitionReport = null;
  if (includeInhibitionReport) {
    const generateReportFn = (typeof window !== 'undefined' && window.HearthMemoryFilter)
      ? window.HearthMemoryFilter.generateInhibitionReport
      : generateInhibitionReport;
    inhibitionReport = generateReportFn(filterResult, goal);
  }
  
  // Build final result
  return {
    goal: {
      type: goal.type,
      id: goal.id,
      label: goal.label,
      description: goal.description,
      confidence: goal.confidence
    },
    filteredMemories: filteredMemories.map(m => ({
      id: m.id,
      content: m.content,
      heat: m.heat,
      relevanceScore: m.goalRelevance ? m.goalRelevance.finalScore : null,
      domains: m.goalRelevance ? m.goalRelevance.domains : []
    })),
    inhibitedCount: filterResult.stats.inhibited,
    stats: filterResult.stats,
    patterns: topPatterns.filter(p => p.confidence.level !== 'LOW' || p.instanceCount >= 2),
    inhibitionReport
  };
}

/**
 * Lightweight version for hot path - just goal + inhibition, no pattern analysis
 */
function quickFilter(memories, queryMessage, conversationContext = []) {
  const extractGoalFn = (typeof window !== 'undefined' && window.HearthGoalExtractor)
    ? window.HearthGoalExtractor.extractGoal
    : extractGoal;
  
  const filterMemoriesFn = (typeof window !== 'undefined' && window.HearthMemoryFilter)
    ? window.HearthMemoryFilter.filterMemoriesByGoal
    : filterMemoriesByGoal;
  
  if (!extractGoalFn || !filterMemoriesFn) {
    return { goal: 'UNCLEAR', memories: memories, inhibitedCount: 0 };
  }
  
  const goal = extractGoalFn(queryMessage, conversationContext);
  const filterResult = filterMemoriesFn(memories, goal, queryMessage);
  
  return {
    goal: goal.type,
    memories: filterResult.filtered,
    inhibitedCount: filterResult.stats.inhibited
  };
}

/**
 * Format Scout V2 output for injection into context
 */
function formatScoutOutput(analysis) {
  if (!analysis || (!analysis.patterns.length && !analysis.goal)) {
    return '';
  }
  
  let output = '---\n';
  output += `**Current Goal:** ${analysis.goal.label}`;
  if (analysis.goal.confidence < 0.5) {
    output += ' (uncertain)';
  }
  output += '\n';
  
  if (analysis.inhibitedCount > 0) {
    output += `*${analysis.inhibitedCount} memories suppressed as not relevant to current goal*\n`;
  }
  
  if (analysis.patterns.length > 0) {
    output += '\n**Behavioral Patterns Detected:**\n';
    for (const pattern of analysis.patterns) {
      output += `- ${pattern.verb} (${pattern.confidence.level} confidence)\n`;
      output += `  → ${pattern.application}\n`;
    }
  }
  
  output += '---\n';
  return output;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    COMPILED_PATTERNS,
    detectPatternsInMemory,
    queryMatchesBridges,
    messageContradictsPattern,
    analyzeWithScoutV2,
    quickFilter,
    formatScoutOutput
  };
}

// Export for browser/page context
if (typeof window !== 'undefined') {
  window.HearthScoutV2 = {
    COMPILED_PATTERNS,
    detectPatternsInMemory,
    queryMatchesBridges,
    messageContradictsPattern,
    analyzeWithScoutV2,
    quickFilter,
    formatScoutOutput
  };
}
