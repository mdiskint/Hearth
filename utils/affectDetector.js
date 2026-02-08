/**
 * Affect Detector - Emotional Container Shape Detection
 *
 * Replaces content-based memory retrieval with structural affect detection.
 * Instead of asking "what is this about?", asks "what shape is this person in?"
 *
 * Three orthogonal axes:
 *   expansion:  -1 (contracted/closed) to +1 (expanded/open)
 *   activation: -1 (frozen/flat)       to +1 (flooded/overwhelmed)
 *   certainty:  -1 (uncertain/seeking) to +1 (certain/directing)
 *
 * The complement function generates the container the person needs —
 * not matching their energy, but completing it.
 */

// ============================================================
// Signal Patterns
// ============================================================

const SIGNALS = {

  // --- Expansion axis ---

  contraction: [
    // Short/clipped structure (checked via metrics, not regex)
    /\bmaybe\b/i,
    /\bI guess\b/i,
    /\bI don't know\b/i,
    /\bI'm not sure\b/i,
    /\bnot really\b/i,
    /\bkind of\b/i,
    /\bsort of\b/i,
    /\bI can't\b/i,
    /\bwon't\b/i,
    /\bdon't\b/i,
    /\bnever mind\b/i,
    /\bforget it\b/i,
    /\bit doesn't matter\b/i,
    /\bwhatever\b/i,
    /\bjust\b/i,          // minimizing marker
    /\bonly\b/i           // constriction marker
  ],

  expansion: [
    /\band (then|also|maybe|so)\b/i,
    /\bbecause\b/i,
    /\bwhich (makes|means|leads|connects)\b/i,
    /\bI've been thinking\b/i,
    /\bwhat if\b/i,
    /\bimagine\b/i,
    /\bcould (we|I|this)\b/i,
    /\bexplore\b/i,
    /\bpossibilit(y|ies)\b/i,
    /\bconnect(s|ed|ion)?\b/i,
    /\bI wonder\b/i,
    /\blet me think\b/i,
    /\bso basically\b/i,
    /\bthe thing is\b/i,
    /\bhere's (what|my|the)\b/i
  ],

  // --- Activation axis ---

  frozen: [
    /^(fine|ok|okay|sure|idk|whatever|nothing|nm|nvm)\.?$/i,
    /\bI don't (know|care|feel)\b/i,
    /\bdoesn't matter\b/i,
    /\bwhatever you think\b/i,
    /\bI have no\b/i,
    /\bnumb\b/i,
    /\bempty\b/i,
    /\bshutdown\b/i,
    /\bcan't think\b/i,
    /\bblank\b/i,
    /\bstuck\b/i,
    /\bflat\b/i
  ],

  flooding: [
    /!{2,}/,                                 // multiple exclamation marks
    /\?{2,}/,                                // multiple question marks
    /[!?]{3,}/,                              // mixed punctuation clusters
    /\b[A-Z]{3,}\b/,                         // ALL CAPS words (3+ letters)
    /\b(totally|completely|absolutely|entirely|utterly)\b/i,
    /\b(so much|too much|everything|all of)\b/i,
    /\b(can't stop|keep thinking|won't stop|can't even)\b/i,
    /\b(overwhelming|overwhelmed|flooded|drowning)\b/i,
    /\b(need to|have to|must)\b/i,
    // Repetition detected via metrics, not regex
  ],

  // --- Certainty axis ---

  uncertainty: [
    /\bshould I\b/i,
    /\bwhat do you think\b/i,
    /\bmight\b/i,
    /\bcould\b/i,
    /\bperhaps\b/i,
    /\bmaybe\b/i,
    /\bI'm not sure\b/i,
    /\bdon't know (if|whether|what|how)\b/i,
    /\bor (maybe|should|could)\b/i,
    /\bwondering (if|whether|about)\b/i,
    /\bis (it|this|that) (right|okay|ok|good|bad)\b/i,
    /\bam I\b/i,
    /\.\.\./                                 // trailing off
  ],

  certainty: [
    /\bI (will|need|want|know|believe|decided)\b/i,
    /\b(do|make|build|create|show|give|tell|fix|run|send)\s+me\b/i,  // imperatives
    /\bI'm going to\b/i,
    /\blet's\b/i,
    /\bhere's the plan\b/i,
    /\bI've decided\b/i,
    /\bthe answer is\b/i,
    /\bI need you to\b/i,
    /\bthis is (what|how|why)\b/i,
    /^[A-Z][^?]*[.!]$/m                     // declarative sentence (no question mark)
  ]
};

// ============================================================
// Structural Metrics (non-regex features)
// ============================================================

function computeStructuralMetrics(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const questions = (text.match(/\?/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;

  // Average sentence length (word count)
  const avgSentenceLen = sentences.length > 0
    ? words.length / sentences.length
    : words.length;

  // Average word length (character count)
  const avgWordLen = words.length > 0
    ? words.reduce((sum, w) => sum + w.length, 0) / words.length
    : 0;

  // Question density
  const questionDensity = sentences.length > 0
    ? questions / sentences.length
    : 0;

  // Word repetition ratio (unique / total)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const repetitionRatio = words.length > 0
    ? 1 - (uniqueWords.size / words.length)
    : 0;

  // Caps ratio (words that are all caps, 3+ letters)
  const capsWords = words.filter(w => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  const capsRatio = words.length > 0 ? capsWords.length / words.length : 0;

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLen,
    avgWordLen,
    questionDensity,
    questions,
    exclamations,
    repetitionRatio,
    capsRatio
  };
}

// ============================================================
// Core Detection
// ============================================================

/**
 * Count pattern matches in text for a signal category
 */
function countSignals(text, signalPatterns) {
  let count = 0;
  const matched = [];
  for (const pattern of signalPatterns) {
    if (pattern.test(text)) {
      count++;
      matched.push(pattern.source.substring(0, 30));
    }
  }
  return { count, matched };
}

/**
 * Detect the emotional container shape from query text.
 *
 * @param {string} query - The user's message
 * @returns {Object} Shape object with three axes and raw signals
 */
function detectAffect(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      expansion: 0,
      activation: 0,
      certainty: 0,
      raw_signals: {}
    };
  }

  const text = query.trim();
  const metrics = computeStructuralMetrics(text);

  // Count regex-based signals
  const contraction = countSignals(text, SIGNALS.contraction);
  const expansion = countSignals(text, SIGNALS.expansion);
  const frozen = countSignals(text, SIGNALS.frozen);
  const flooding = countSignals(text, SIGNALS.flooding);
  const uncertainty = countSignals(text, SIGNALS.uncertainty);
  const certainty = countSignals(text, SIGNALS.certainty);

  // --- Expansion axis ---
  // Structural: short messages and short sentences → contraction
  // Long flowing text → expansion
  let expansionScore = 0;
  const expansionPatternDelta = expansion.count - contraction.count;
  expansionScore += clamp(expansionPatternDelta * 0.2, -0.6, 0.6);

  // Short messages are contracting
  if (metrics.wordCount <= 3) expansionScore -= 0.4;
  else if (metrics.wordCount <= 8) expansionScore -= 0.2;
  else if (metrics.wordCount >= 30) expansionScore += 0.2;
  else if (metrics.wordCount >= 60) expansionScore += 0.3;

  // Long average sentences = flowing/expanding
  if (metrics.avgSentenceLen >= 15) expansionScore += 0.15;
  if (metrics.avgSentenceLen <= 4) expansionScore -= 0.15;

  expansionScore = clamp(expansionScore, -1, 1);

  // --- Activation axis ---
  // Frozen: minimal text, flat markers
  // Flooded: repetition, caps, intensifiers, punctuation
  let activationScore = 0;
  const activationPatternDelta = flooding.count - frozen.count;
  activationScore += clamp(activationPatternDelta * 0.2, -0.6, 0.6);

  // Structural flooding signals
  if (metrics.capsRatio > 0.3) activationScore += 0.3;
  else if (metrics.capsRatio > 0.1) activationScore += 0.15;
  if (metrics.exclamations >= 3) activationScore += 0.2;
  if (metrics.repetitionRatio > 0.4) activationScore += 0.2;

  // Structural frozen signals
  if (metrics.wordCount <= 2) activationScore -= 0.5;
  else if (metrics.wordCount <= 5 && frozen.count > 0) activationScore -= 0.3;

  activationScore = clamp(activationScore, -1, 1);

  // --- Certainty axis ---
  let certaintyScore = 0;
  const certaintyPatternDelta = certainty.count - uncertainty.count;
  certaintyScore += clamp(certaintyPatternDelta * 0.2, -0.6, 0.6);

  // Question clusters = uncertainty
  if (metrics.questionDensity >= 0.5) certaintyScore -= 0.25;
  else if (metrics.questionDensity >= 0.3) certaintyScore -= 0.1;

  // Imperatives with no questions = certainty
  if (metrics.questions === 0 && certainty.count > 0) certaintyScore += 0.2;

  // Very short + no hedging = certain (commands)
  if (metrics.wordCount <= 6 && uncertainty.count === 0 && contraction.count === 0 && frozen.count === 0) {
    certaintyScore += 0.2;
  }

  certaintyScore = clamp(certaintyScore, -1, 1);

  // Round all to 2 decimal places
  return {
    expansion: round2(expansionScore),
    activation: round2(activationScore),
    certainty: round2(certaintyScore),
    raw_signals: {
      contraction: contraction.count,
      expansion: expansion.count,
      frozen: frozen.count,
      flooding: flooding.count,
      uncertainty: uncertainty.count,
      certainty: certainty.count,
      metrics
    }
  };
}

// ============================================================
// Complement Generation
// ============================================================

/**
 * Complement table: for each axis extreme, what modulation is needed.
 *
 * The logic is not "mirror" — it's "what shape would help this person
 * move toward their next useful state?"
 */
const COMPLEMENTS = {
  expansion: {
    contracted: {
      threshold: -0.15,
      modulation: 'expansive',
      opspec: 'Open gently. Offer possibilities without demanding choice. Use "what if" and "I wonder" language. Don\'t push — create space they can step into. Longer sentences, softer framing. Avoid bullet points and lists — they compress.'
    },
    expanded: {
      threshold: 0.15,
      modulation: 'focusing',
      opspec: 'They\'re open and flowing. Help them land somewhere. Reflect the core thread back. Ask "which of these feels most alive?" Don\'t add more — help crystallize what\'s already there.'
    }
  },

  activation: {
    frozen: {
      threshold: -0.15,
      modulation: 'warming',
      opspec: 'They\'re shut down or flat. Don\'t ask big questions. Don\'t analyze. Offer small, concrete, low-stakes starting points. "We could just..." Permission-giving language. Warmth without demand. Match their pace, then very gradually lift.'
    },
    flooded: {
      threshold: 0.15,
      modulation: 'spacious',
      opspec: 'They\'re overwhelmed or accelerating. Slow the pace. Short, grounded sentences. Name one thing at a time. Don\'t match their energy — be the steady surface. "Let\'s pause on just this one piece." Create breathing room between ideas.'
    }
  },

  certainty: {
    uncertain: {
      threshold: -0.15,
      modulation: 'grounding',
      opspec: 'They\'re seeking and unsure. Don\'t pile on more options. Offer one concrete frame or anchor. "Here\'s one way to think about this." Name what seems true from what they\'ve said. Give them something solid to push against.'
    },
    certain: {
      threshold: 0.15,
      modulation: 'executing',
      opspec: 'They know what they want. Don\'t second-guess or over-explain. Execute. Match their directness. If they\'re wrong, say so directly — they can handle it. No hedging, no preamble.'
    }
  }
};

/**
 * Generate the complementary container as an OpSpec fragment.
 *
 * @param {Object} shape - Output from detectAffect()
 * @returns {Object} Complement with modulations and assembled OpSpec fragment
 */
function generateComplement(shape) {
  if (!shape) return { modulations: [], opspec: '' };

  const modulations = [];
  const opspecParts = [];

  // Check each axis
  for (const [axis, poles] of Object.entries(COMPLEMENTS)) {
    const value = shape[axis];
    if (typeof value !== 'number') continue;

    for (const [pole, config] of Object.entries(poles)) {
      const isNegativePole = config.threshold < 0;
      const triggered = isNegativePole
        ? value <= config.threshold
        : value >= config.threshold;

      if (triggered) {
        modulations.push({
          axis,
          pole,
          value,
          modulation: config.modulation
        });
        opspecParts.push(config.opspec);
      }
    }
  }

  // Always output the shape reading + any modulations
  const shapeLabel = `Shape: expansion=${shape.expansion}, activation=${shape.activation}, certainty=${shape.certainty}`;

  if (opspecParts.length === 0) {
    // Neutral — no modulation, but still inject the shape for transparency
    return {
      modulations: [],
      opspec: `[AFFECT COMPLEMENT]\n${shapeLabel}\nNo active modulation — neutral container.\n[END AFFECT COMPLEMENT]`
    };
  }

  const opspec = `[AFFECT COMPLEMENT]\n${shapeLabel}\n\n${opspecParts.join('\n\n')}\n[END AFFECT COMPLEMENT]`;

  return {
    modulations,
    opspec
  };
}

// ============================================================
// Utilities
// ============================================================

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function round2(val) {
  return Math.round(val * 100) / 100;
}

// ============================================================
// Test Suite
// ============================================================

function testAffectDetector() {
  const cases = [
    {
      label: 'Contracted + Uncertain',
      query: "I don't know what to do",
      expect: { expansion: 'negative', certainty: 'negative' }
    },
    {
      label: 'Flooded + Uncertain',
      query: "So I've been thinking and maybe we could try this thing but I'm not sure if it would work and there's also this other option and I keep going back and forth and I just can't decide!!!",
      expect: { activation: 'positive', certainty: 'negative' }
    },
    {
      label: 'Expanded + Certain',
      query: 'Build me a dashboard',
      expect: { certainty: 'positive' }
    },
    {
      label: 'Frozen',
      query: 'fine',
      expect: { activation: 'negative', expansion: 'negative' }
    },
    {
      label: 'Flowing + Exploring',
      query: "I've been thinking about how the memory system connects to the affect model, and what if we treated each conversation as having a shape — like a container that the AI learns to complement rather than match? Because matching someone's anxiety just amplifies it, but complementing it with grounded calm actually helps them regulate.",
      expect: { expansion: 'positive' }
    },
    {
      label: 'Commanding',
      query: 'Fix the bug in the login flow. Deploy to staging.',
      expect: { certainty: 'positive' }
    },
    {
      label: 'Spiraling',
      query: "Should I use React or Vue or Svelte?? Or maybe just vanilla JS??? I NEED to decide but every option has tradeoffs and I keep finding MORE frameworks!!",
      expect: { activation: 'positive', certainty: 'negative' }
    },
    {
      label: 'Shutdown',
      query: 'idk',
      expect: { activation: 'negative', expansion: 'negative' }
    }
  ];

  console.log('=== Affect Detector Tests ===\n');

  for (const tc of cases) {
    const shape = detectAffect(tc.query);
    const complement = generateComplement(shape);

    console.log(`[${tc.label}]`);
    console.log(`  Query: "${tc.query.substring(0, 80)}${tc.query.length > 80 ? '...' : ''}"`);
    console.log(`  Shape: expansion=${shape.expansion}, activation=${shape.activation}, certainty=${shape.certainty}`);

    // Check expectations
    const checks = [];
    if (tc.expect.expansion) {
      const pass = tc.expect.expansion === 'negative' ? shape.expansion < 0 : shape.expansion > 0;
      checks.push(`expansion ${tc.expect.expansion}: ${pass ? 'PASS' : 'FAIL'}`);
    }
    if (tc.expect.activation) {
      const pass = tc.expect.activation === 'negative' ? shape.activation < 0 : shape.activation > 0;
      checks.push(`activation ${tc.expect.activation}: ${pass ? 'PASS' : 'FAIL'}`);
    }
    if (tc.expect.certainty) {
      const pass = tc.expect.certainty === 'negative' ? shape.certainty < 0 : shape.certainty > 0;
      checks.push(`certainty ${tc.expect.certainty}: ${pass ? 'PASS' : 'FAIL'}`);
    }

    console.log(`  Checks: ${checks.join(', ')}`);

    if (complement.modulations.length > 0) {
      console.log(`  Complement: ${complement.modulations.map(m => m.modulation).join(' + ')}`);
    } else {
      console.log('  Complement: (neutral — no modulation)');
    }
    console.log('');
  }
}

// ============================================================
// Exports
// ============================================================

// Browser export first (page context — must run before module.exports)
if (typeof window !== 'undefined') {
  window.HearthAffectDetector = {
    detectAffect,
    generateComplement,
    computeStructuralMetrics,
    SIGNALS,
    COMPLEMENTS,
    testAffectDetector
  };
}

// Node/CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectAffect,
    generateComplement,
    computeStructuralMetrics,
    SIGNALS,
    COMPLEMENTS,
    testAffectDetector
  };
}
