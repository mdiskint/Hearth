/**
 * Memory Filter - Goal-Dependent Inhibition for Retrieved Memories
 * 
 * This is the core inhibition mechanism. After memories are retrieved by
 * semantic similarity + heat, this filter decides which ones actually
 * serve the current goal and which should be suppressed.
 * 
 * Mirrors prefrontal cortex function: doesn't just select relevant,
 * actively INHIBITS irrelevant even if semantically activated.
 */

// Memory domain keywords for classification
const MEMORY_DOMAIN_KEYWORDS = {
  technical: [
    'code', 'programming', 'bug', 'error', 'function', 'api', 'database',
    'server', 'client', 'frontend', 'backend', 'debug', 'deploy', 'git',
    'javascript', 'python', 'react', 'node', 'sql', 'css', 'html'
  ],
  emotional: [
    'feel', 'feeling', 'emotion', 'anxious', 'worried', 'happy', 'sad',
    'frustrated', 'overwhelmed', 'stressed', 'excited', 'afraid', 'angry',
    'love', 'hate', 'relationship', 'therapy', 'mental health'
  ],
  project: [
    'hearth', 'aurora', 'project', 'build', 'feature', 'milestone',
    'roadmap', 'architecture', 'design', 'implementation'
  ],
  personal: [
    'family', 'wife', 'kids', 'children', 'home', 'house', 'vacation',
    'health', 'exercise', 'sleep', 'routine', 'habit'
  ],
  professional: [
    'work', 'job', 'career', 'client', 'meeting', 'deadline', 'salary',
    'interview', 'resume', 'company', 'business'
  ],
  learning: [
    'learn', 'understand', 'study', 'course', 'book', 'concept',
    'theory', 'practice', 'skill', 'knowledge'
  ],
  creative: [
    'write', 'writing', 'story', 'creative', 'idea', 'brainstorm',
    'design', 'art', 'music', 'fiction'
  ],
  decision: [
    'decide', 'decision', 'choice', 'option', 'tradeoff', 'pros', 'cons',
    'should', 'whether', 'compare', 'evaluate'
  ],
  values: [
    'value', 'believe', 'important', 'principle', 'priority', 'goal',
    'meaning', 'purpose', 'ethics', 'integrity'
  ]
};

/**
 * Classify a memory's domain based on its content
 * 
 * @param {Object} memory - Memory object with content field
 * @returns {Array} Array of detected domains
 */
function classifyMemoryDomain(memory) {
  const content = (memory.content || '').toLowerCase();
  const domains = [];
  
  for (const [domain, keywords] of Object.entries(MEMORY_DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        domains.push(domain);
        break; // Only add domain once
      }
    }
  }
  
  // Add any explicit domains from memory metadata
  if (memory.domains && Array.isArray(memory.domains)) {
    for (const d of memory.domains) {
      if (!domains.includes(d.toLowerCase())) {
        domains.push(d.toLowerCase());
      }
    }
  }
  
  return domains.length > 0 ? domains : ['general'];
}

/**
 * Calculate goal relevance score for a memory
 * 
 * @param {Object} memory - Memory object
 * @param {Object} goal - Goal object from extractGoal
 * @param {string} query - Current query for semantic matching
 * @returns {Object} Relevance scoring breakdown
 */
function scoreMemoryRelevance(memory, goal, query) {
  const domains = classifyMemoryDomain(memory);
  const content = (memory.content || '').toLowerCase();
  const queryLower = query.toLowerCase();
  
  let boostScore = 0;
  let inhibitScore = 0;
  let domainMatches = [];
  let domainInhibits = [];
  
  // Check domain boost/inhibit
  for (const domain of domains) {
    // Check if goal boosts this domain
    for (const relevantType of goal.relevantMemoryTypes) {
      if (domain.includes(relevantType) || relevantType.includes(domain)) {
        boostScore += 1;
        domainMatches.push(domain);
      }
    }
    
    // Check if goal inhibits this domain
    for (const inhibitType of goal.inhibitedMemoryTypes) {
      if (domain.includes(inhibitType) || inhibitType.includes(domain)) {
        inhibitScore += 1;
        domainInhibits.push(domain);
      }
    }
  }
  
  // Check direct query term overlap
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 3);
  let queryOverlap = 0;
  for (const term of queryTerms) {
    if (content.includes(term)) {
      queryOverlap++;
    }
  }
  
  // Normalize query overlap to 0-1 range
  const queryRelevance = queryTerms.length > 0 
    ? queryOverlap / queryTerms.length 
    : 0;
  
  // Factor in memory's existing heat score if present
  const heatBoost = memory.heat ? memory.heat / 100 : 0.5;
  
  // Calculate final relevance score
  // Formula: (boost - inhibit) * goal_confidence + query_relevance + heat
  const rawScore = (boostScore - inhibitScore * 1.5) * goal.confidence 
                   + queryRelevance 
                   + heatBoost * 0.5;
  
  // Normalize to 0-1 range (clamped)
  const finalScore = Math.max(0, Math.min(1, (rawScore + 1) / 3));
  
  return {
    finalScore,
    boostScore,
    inhibitScore,
    queryRelevance,
    heatBoost,
    domains,
    domainMatches,
    domainInhibits,
    isInhibited: inhibitScore > boostScore,
    isBoosted: boostScore > 0 && boostScore > inhibitScore
  };
}

/**
 * Filter and score memories based on goal relevance
 * 
 * @param {Array} memories - Array of retrieved memories
 * @param {Object} goal - Goal object from extractGoal
 * @param {string} query - Current query
 * @param {Object} options - Filtering options
 * @returns {Object} Filtered memories and statistics
 */
function filterMemoriesByGoal(memories, goal, query, options = {}) {
  const {
    minRelevanceScore = 0.3,    // Below this = inhibited
    maxMemories = 3,             // Maximum memories to return
    includeInhibited = false,    // Whether to include inhibited memories in output
    preserveHighHeat = true      // Keep very high heat memories regardless
  } = options;
  
  if (!memories || memories.length === 0) {
    return {
      filtered: [],
      inhibited: [],
      stats: { total: 0, kept: 0, inhibited: 0 }
    };
  }
  
  const scored = [];
  const inhibited = [];
  
  // Score each memory
  for (const memory of memories) {
    const relevance = scoreMemoryRelevance(memory, goal, query);
    
    const scoredMemory = {
      ...memory,
      goalRelevance: relevance
    };
    
    // Decide keep or inhibit
    const shouldKeep = relevance.finalScore >= minRelevanceScore
      || (preserveHighHeat && memory.heat && memory.heat >= 90)
      || goal.relevantMemoryTypes.includes('all');
    
    if (shouldKeep) {
      scored.push(scoredMemory);
    } else {
      inhibited.push(scoredMemory);
    }
  }
  
  // Sort by relevance score (highest first)
  scored.sort((a, b) => b.goalRelevance.finalScore - a.goalRelevance.finalScore);
  
  // Take top N
  const filtered = scored.slice(0, maxMemories);

  // Quality floor: if best memory is below threshold, return nothing
  // rather than surfacing low-quality memories
  if (filtered.length > 0 && filtered[0].goalRelevance.finalScore < 0.5) {
    return {
      filtered: [],
      inhibited: includeInhibited ? [...inhibited, ...filtered] : [],
      stats: {
        total: memories.length,
        kept: 0,
        inhibited: inhibited.length + filtered.length,
        avgRelevanceScore: 0,
        goalType: goal.type,
        goalConfidence: goal.confidence,
        qualityFloorApplied: true
      }
    };
  }

  // Build statistics
  const stats = {
    total: memories.length,
    kept: filtered.length,
    inhibited: inhibited.length,
    avgRelevanceScore: filtered.length > 0
      ? filtered.reduce((sum, m) => sum + m.goalRelevance.finalScore, 0) / filtered.length
      : 0,
    goalType: goal.type,
    goalConfidence: goal.confidence
  };
  
  return {
    filtered,
    inhibited: includeInhibited ? inhibited : [],
    stats
  };
}

/**
 * Quick check if a memory should be inhibited (for hot path)
 * 
 * @param {Object} memory - Memory object
 * @param {Object} goal - Goal object
 * @returns {boolean} True if should be inhibited
 */
function shouldInhibitMemory(memory, goal) {
  const domains = classifyMemoryDomain(memory);
  
  // If goal doesn't inhibit anything, keep
  if (goal.inhibitedMemoryTypes.length === 0) {
    return false;
  }
  
  // If goal wants all memories, don't inhibit
  if (goal.relevantMemoryTypes.includes('all')) {
    return false;
  }
  
  // Check for domain-based inhibition
  for (const domain of domains) {
    for (const inhibitType of goal.inhibitedMemoryTypes) {
      if (domain.includes(inhibitType) || inhibitType.includes(domain)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Generate inhibition report for transparency/debugging
 * 
 * @param {Object} filterResult - Result from filterMemoriesByGoal
 * @param {Object} goal - Goal object
 * @returns {string} Human-readable report
 */
function generateInhibitionReport(filterResult, goal) {
  const { filtered, inhibited, stats } = filterResult;
  
  let report = `## Goal-Dependent Memory Filtering\n\n`;
  report += `**Detected Goal:** ${goal.label} (${(goal.confidence * 100).toFixed(0)}% confidence)\n`;
  report += `**Description:** ${goal.description}\n\n`;
  report += `**Memory Stats:**\n`;
  report += `- Retrieved: ${stats.total}\n`;
  report += `- Kept: ${stats.kept}\n`;
  report += `- Inhibited: ${stats.inhibited}\n`;
  report += `- Avg Relevance: ${(stats.avgRelevanceScore * 100).toFixed(0)}%\n\n`;
  
  if (filtered.length > 0) {
    report += `**Kept Memories:**\n`;
    for (const m of filtered.slice(0, 5)) {
      const preview = (m.content || '').substring(0, 60) + '...';
      report += `- [${(m.goalRelevance.finalScore * 100).toFixed(0)}%] ${preview}\n`;
    }
    report += `\n`;
  }
  
  if (inhibited.length > 0) {
    report += `**Inhibited Memories (not surfaced):**\n`;
    for (const m of inhibited.slice(0, 3)) {
      const preview = (m.content || '').substring(0, 60) + '...';
      const reason = m.goalRelevance.domainInhibits.join(', ') || 'low relevance';
      report += `- [${reason}] ${preview}\n`;
    }
  }
  
  return report;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MEMORY_DOMAIN_KEYWORDS,
    classifyMemoryDomain,
    scoreMemoryRelevance,
    filterMemoriesByGoal,
    shouldInhibitMemory,
    generateInhibitionReport
  };
}

// Export for browser/page context
if (typeof window !== 'undefined') {
  window.HearthMemoryFilter = {
    MEMORY_DOMAIN_KEYWORDS,
    classifyMemoryDomain,
    scoreMemoryRelevance,
    filterMemoriesByGoal,
    shouldInhibitMemory,
    generateInhibitionReport
  };
}
