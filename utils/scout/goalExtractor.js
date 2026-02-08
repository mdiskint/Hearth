/**
 * Goal Extractor - Identifies the user's current goal from query + context
 * 
 * This is the "prefrontal cortex" function that determines what the user
 * is actually trying to accomplish, which then drives memory inhibition.
 * 
 * Goal types map to different relevance criteria for memory filtering.
 */

const GOAL_TAXONOMY = {
  // Technical/Building goals
  // Available domains: technical, emotional, project, personal, professional, learning, creative, decision, values
  DEBUG: {
    id: 'debug',
    label: 'Debugging/Fixing',
    description: 'User is trying to fix something broken',
    memoryRelevance: ['technical', 'project'],
    memoryInhibit: ['emotional', 'personal']
  },
  BUILD: {
    id: 'build',
    label: 'Building/Creating',
    description: 'User is constructing something new',
    memoryRelevance: ['technical', 'project', 'creative'],
    memoryInhibit: ['emotional', 'personal']
  },
  LEARN: {
    id: 'learn',
    label: 'Learning/Understanding',
    description: 'User wants to understand a concept or domain',
    memoryRelevance: ['learning', 'technical'],
    memoryInhibit: ['project']
  },
  
  // Decision/Planning goals
  DECIDE: {
    id: 'decide',
    label: 'Making a Decision',
    description: 'User needs to choose between options',
    memoryRelevance: ['values', 'decision', 'professional'],
    memoryInhibit: ['technical']
  },
  PLAN: {
    id: 'plan',
    label: 'Planning/Strategizing',
    description: 'User is thinking about future actions',
    memoryRelevance: ['project', 'professional', 'decision'],
    memoryInhibit: ['emotional']
  },
  
  // Emotional/Processing goals
  PROCESS: {
    id: 'process',
    label: 'Emotional Processing',
    description: 'User is working through feelings or experiences',
    memoryRelevance: ['emotional', 'values', 'personal'],
    memoryInhibit: ['technical', 'project']
  },
  VENT: {
    id: 'vent',
    label: 'Venting/Expressing',
    description: 'User needs to be heard, not solved',
    memoryRelevance: ['emotional', 'personal'],
    memoryInhibit: ['technical', 'project', 'decision']
  },
  
  // Information goals
  RECALL: {
    id: 'recall',
    label: 'Recalling/Finding',
    description: 'User wants to find specific past information',
    memoryRelevance: ['all'],
    memoryInhibit: []
  },
  INFORM: {
    id: 'inform',
    label: 'Getting Information',
    description: 'User wants factual information',
    memoryRelevance: ['learning', 'professional'],
    memoryInhibit: ['emotional', 'personal']
  },
  
  // Creative goals
  CREATE: {
    id: 'create',
    label: 'Creative Work',
    description: 'User is doing creative/generative work',
    memoryRelevance: ['creative', 'values'],
    memoryInhibit: ['technical']
  },
  EXPLORE: {
    id: 'explore',
    label: 'Open-Ended Exploration',
    description: 'User is curious or thinking openly, not debugging or deciding',
    memoryRelevance: ['creative', 'learning', 'values'],
    memoryInhibit: []
  },
  
  // Meta/Unclear
  CONTINUE: {
    id: 'continue',
    label: 'Continuing Previous',
    description: 'User is continuing an established thread',
    memoryRelevance: ['all'],
    memoryInhibit: []
  },
  UNCLEAR: {
    id: 'unclear',
    label: 'Goal Unclear',
    description: 'Cannot determine specific goal',
    memoryRelevance: ['all'],
    memoryInhibit: []
  }
};

// Query patterns that indicate specific goals
const GOAL_INDICATORS = {
  DEBUG: [
    /\b(fix|debug|broken|error|bug|issue|problem|crash|fail|wrong|not working)\b/i,
    /\bwhy (is|does|isn't|doesn't|won't)\b/i,
    /\bhelp.*(fix|debug|solve)\b/i,
    /\bstack ?trace\b/i,
    /\b(doesn't|does not|won't|will not) (work|compile|run)\b/i
  ],
  BUILD: [
    /\b(build|create|make|implement|add|develop|write|code)\b/i,
    /\bhow (do|can|should) I (build|create|make|implement)\b/i,
    /\blet's (build|create|make)\b/i,
    /\bI want to (build|create|make)\b/i
  ],
  LEARN: [
    /\b(explain|understand|learn|teach|how does|what is|what are)\b/i,
    /\bwhat('s| is) the (difference|relationship)\b/i,
    /\bcan you explain\b/i,
    /\bI don't understand\b/i
  ],
  DECIDE: [
    /\bshould I\b/i,
    /\bwhich (one|option|approach|way)\b/i,
    /\b(decide|choose|pick) between\b/i,
    /\bwhat would you (recommend|suggest)\b/i,
    /\b(pros|cons|tradeoffs)\b/i,
    /\bor should I\b/i,
    /\b(simplify|prioritize|focus|cut|eliminate|streamline|reduce)\b/i
  ],
  PLAN: [
    /\b(plan|strategy|roadmap|timeline|steps|approach)\b/i,
    /\bhow should I (approach|tackle|handle)\b/i,
    /\bwhat's (the best|a good) (way|approach)\b/i,
    /\bnext steps\b/i,
    /\b(organize|structure|manage|arrange)\b/i,
    /\bsort out\b/i,
    /\bget control\b/i
  ],
  PROCESS: [
    /\bI feel\b/i,
    /\bI'm (feeling|worried|anxious|stressed|overwhelmed|sad|frustrated|terrified|scared|afraid)\b/i,
    /\bthis is (hard|difficult|tough)\b/i,
    /\bI've been (thinking|struggling|dealing)\b/i,
    /\b(life|everything|all of this)\b/i,
    /\btoo much\b/i,
    /\bcan't handle\b/i,
    /\b(wrong choice|bad decision|mistake|regret)\b/i,
    /\bterrified\b/i,
    /\bscared\b/i
  ],
  VENT: [
    /\bI (just|need to) (need to )?vent\b/i,
    /\bI'm so (frustrated|angry|annoyed|tired)\b/i,
    /\bcan I just\b/i,
    /\bI hate\b/i
  ],
  RECALL: [
    /\b(remember|recall|find|where|when) (did|do|was|were)\b/i,
    /\bwhat did (we|I|you) (say|discuss|decide)\b/i,
    /\bfrom (our|a previous|last) (conversation|chat|discussion)\b/i,
    /\bdidn't (we|I|you)\b/i
  ],
  INFORM: [
    /\bwhat is\b/i,
    /\bhow (much|many|long|far)\b/i,
    /\bwhen (is|was|did)\b/i,
    /\bwho (is|was)\b/i,
    /\bwhere (is|was|can)\b/i
  ],
  CREATE: [
    /\bwrite (me )?a\b/i,
    /\bgenerate\b/i,
    /\bdraft\b/i,
    /\bcompose\b/i,
    /\bcreate (a|an|some)\b/i
  ],
  EXPLORE: [
    /\bwhat if\b/i,
    /\bbrainstorm\b/i,
    /\bexplore\b/i,
    /\blet's think about\b/i,
    /\bideas for\b/i,
    /\bpossibilities\b/i,
    /\btell me about\b/i,
    /\bwhat do you think\b/i,
    /\bI'm curious\b/i,
    /\bwondering\b/i
  ],
  CONTINUE: [
    /\b(continue|continuing|pick up|back to)\b/i,
    /\bwhere were we\b/i,
    /\bas (we|I) (were|was) (saying|discussing)\b/i,
    /\banyway\b/i
  ]
};

/**
 * Extract the user's current goal from query and conversation context
 * 
 * @param {string} query - Current user message
 * @param {Array} conversationContext - Recent conversation turns [{role, content}, ...]
 * @returns {Object} Goal object with type, confidence, and relevance criteria
 */
function extractGoal(query, conversationContext = []) {
  const scores = {};
  
  // Initialize scores
  for (const goalType of Object.keys(GOAL_TAXONOMY)) {
    scores[goalType] = 0;
  }
  
  // Score based on query patterns
  for (const [goalType, patterns] of Object.entries(GOAL_INDICATORS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        scores[goalType] += 1;
      }
    }
  }
  
  // Boost CONTINUE if conversation context suggests ongoing thread
  if (conversationContext.length > 2) {
    scores.CONTINUE += 0.5;
  }
  
  // Check conversation context for goal continuity
  if (conversationContext.length > 0) {
    const recentAssistant = conversationContext
      .filter(turn => turn.role === 'assistant')
      .slice(-2)
      .map(turn => turn.content)
      .join(' ');
    
    // If recent responses were code-heavy, likely BUILD or DEBUG context
    if (/```/.test(recentAssistant)) {
      scores.BUILD += 0.5;
      scores.DEBUG += 0.5;
    }
  }
  
  // Find highest scoring goal
  let maxScore = 0;
  let detectedGoal = 'UNCLEAR';
  
  for (const [goalType, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedGoal = goalType;
    }
  }
  
  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;
  
  // Get the goal definition
  const goalDef = GOAL_TAXONOMY[detectedGoal];
  
  return {
    type: detectedGoal,
    id: goalDef.id,
    label: goalDef.label,
    description: goalDef.description,
    confidence: confidence,
    rawScore: maxScore,
    relevantMemoryTypes: goalDef.memoryRelevance,
    inhibitedMemoryTypes: goalDef.memoryInhibit,
    allScores: scores // For debugging
  };
}

/**
 * Check if a goal suggests we should inhibit a particular memory type
 * 
 * @param {Object} goal - Goal object from extractGoal
 * @param {string} memoryType - Type/domain of memory
 * @returns {boolean} True if this memory type should be inhibited
 */
function shouldInhibitMemoryType(goal, memoryType) {
  if (goal.inhibitedMemoryTypes.length === 0) {
    return false;
  }
  
  const normalizedType = memoryType.toLowerCase();
  
  for (const inhibitType of goal.inhibitedMemoryTypes) {
    if (normalizedType.includes(inhibitType.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a goal suggests we should boost a particular memory type
 * 
 * @param {Object} goal - Goal object from extractGoal
 * @param {string} memoryType - Type/domain of memory
 * @returns {boolean} True if this memory type should be boosted
 */
function shouldBoostMemoryType(goal, memoryType) {
  if (goal.relevantMemoryTypes.includes('all')) {
    return true;
  }
  
  const normalizedType = memoryType.toLowerCase();
  
  for (const relevantType of goal.relevantMemoryTypes) {
    if (normalizedType.includes(relevantType.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GOAL_TAXONOMY,
    GOAL_INDICATORS,
    extractGoal,
    shouldInhibitMemoryType,
    shouldBoostMemoryType
  };
}

// Export for browser/page context
if (typeof window !== 'undefined') {
  window.HearthGoalExtractor = {
    GOAL_TAXONOMY,
    GOAL_INDICATORS,
    extractGoal,
    shouldInhibitMemoryType,
    shouldBoostMemoryType
  };
}
