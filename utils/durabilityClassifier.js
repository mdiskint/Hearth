/**
 * Durability Classifier - Assigns temporal lifespan to memories
 *
 * Three durability levels:
 *   - ephemeral:  Task-level, decays fast (e.g. "wants to connect to Dropbox via MCP")
 *   - contextual: Project-state, medium lifespan (e.g. "exploring Hearth as research assistant")
 *   - durable:    Behavioral invariant, long-lived (e.g. "spirals via option-accumulation")
 */

const DURABILITY_PATTERNS = {
  ephemeral: [
    // Intent / immediate tasks
    /\bwants? to\b/i,
    /\btrying to\b/i,
    /\bneeds? to\b/i,
    /\bplanning to\b/i,
    /\babout to\b/i,
    /\bcurrently (doing|running|testing|debugging|fixing)\b/i,
    // Specific tool / service names (task-scoped)
    /\b(MCP|API key|endpoint|localhost|port \d+)\b/i,
    /\binstall(ing|ed)?\b/i,
    /\bconfigure[ds]?\b/i,
    /\bset(ting)? up\b/i,
    /\bconnect(ing|ed)? to\b/i,
    // Temporal immediacy
    /\bright now\b/i,
    /\btoday\b/i,
    /\bthis (session|conversation|chat)\b/i
  ],

  contextual: [
    // Project / phase state
    /\bworking on\b/i,
    /\bexploring\b/i,
    /\bbuilding\b/i,
    /\bin the middle of\b/i,
    /\bcurrent(ly)? (project|phase|sprint|focus)\b/i,
    // Project names as signals (not tool names)
    /\b(hearth|aurora|extension|platform|prototype)\b/i,
    /\brefactor(ing)?\b/i,
    /\bmigrat(ing|ion)\b/i,
    /\bexperiment(ing)? with\b/i,
    /\blearning\b/i,
    /\bresearch(ing)?\b/i,
    // Role / context state
    /\b(role|team|collaborat)\b/i,
    /\bthis (week|month|quarter)\b/i
  ],

  durable: [
    // Behavioral patterns
    /\bpattern\b/i,
    /\btends? to\b/i,
    /\balways\b/i,
    /\bnever\b/i,
    /\busually\b/i,
    /\bconsistently\b/i,
    // Values / identity
    /\bvalues?\b/i,
    /\bbelieves?\b/i,
    /\bprinciple\b/i,
    /\bidentity\b/i,
    /\bpersonality\b/i,
    // Process descriptors
    /\bprocess(es)?\b/i,
    /\bapproach(es)?\b/i,
    /\bstyle\b/i,
    /\bprefers?\b/i,
    /\bhabit\b/i,
    // Cognitive / behavioral verbs
    /\bspirals?\b/i,
    /\boverthink/i,
    /\bprocrastinat/i,
    /\bperfectionist/i,
    /\b(decision|option).?accumulat/i,
    // Relationship patterns
    /\bwhen (stressed|overwhelmed|anxious|excited)\b/i,
    /\bcoping\b/i,
    /\bdefault(s)? to\b/i
  ]
};

/**
 * Classify a memory's durability based on its text content
 *
 * @param {string} memoryText - The memory content to classify
 * @returns {string} 'ephemeral' | 'contextual' | 'durable'
 */
function classifyDurability(memoryText) {
  if (!memoryText || typeof memoryText !== 'string') {
    return 'contextual'; // safe default
  }

  const text = memoryText.trim();

  // Score each durability level by pattern match count
  const scores = { ephemeral: 0, contextual: 0, durable: 0 };

  for (const [level, patterns] of Object.entries(DURABILITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores[level]++;
      }
    }
  }

  // Durable wins ties with contextual (behavioral invariants are high-value)
  // Ephemeral wins ties with contextual (task specificity is clear signal)
  if (scores.durable > 0 && scores.durable >= scores.contextual && scores.durable >= scores.ephemeral) {
    return 'durable';
  }

  if (scores.ephemeral > 0 && scores.ephemeral >= scores.contextual) {
    return 'ephemeral';
  }

  if (scores.contextual > 0) {
    return 'contextual';
  }

  // No patterns matched — default to contextual (middle ground)
  return 'contextual';
}

// Export for module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DURABILITY_PATTERNS,
    classifyDurability
  };
}

// Export for browser/page context
if (typeof window !== 'undefined') {
  window.HearthDurabilityClassifier = {
    DURABILITY_PATTERNS,
    classifyDurability
  };
}
