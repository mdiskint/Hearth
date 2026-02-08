/**
 * Forge Creative Phase Detector
 *
 * Detects creative phases from conversation trajectory and generates
 * complementary instructions that fuse with affect shape.
 *
 * Four phases: DIVERGING, INCUBATING, CONVERGING, REFINING
 * Two output axes: openness (0-1), materiality (0-1)
 *
 * Exposed as window.HearthForgeDetector with .detect(message, affectShape)
 */

// ============================================================
// Phase Pattern Lexicons
// ============================================================

const PHASE_PATTERNS = {
  DIVERGING: [
    /\bwhat if\b/i,
    /\bcould we\b/i,
    /\bmaybe\b/i,
    /\bwhat about\b/i,
    /\bor\b/i,
    /\banother way\b/i,
    /\banother option\b/i,
    /\banother idea\b/i,
    /\balternative\b/i,
    /\bbrainstorm\b/i,
    /\bexplore\b/i,
    /\bpossibilit(y|ies)\b/i,
    /\bimagine\b/i,
    /\bwild idea\b/i,
    /\bspitball\b/i,
    /\bexperiment\b/i,
    /\bplay with\b/i,
    /\briff on\b/i
  ],

  INCUBATING: [
    /\bI'm stuck\b/i,
    /\bI'm confused\b/i,
    /\bI'm lost\b/i,
    /\bI'm circling\b/i,
    /\bsomething like\b/i,
    /\bsomething about\b/i,
    /\bsomething around\b/i,
    /\bI can't quite\b/i,
    /\bnot quite\b/i,
    /\bhard to explain\b/i,
    /\bhard to articulate\b/i,
    /\bhmm+\b/i,
    /\bI keep coming back\b/i,
    /\bI keep thinking\b/i,
    /\blet me think\b/i,
    /\blet me sit with\b/i
  ],

  CONVERGING: [
    /\blet's go with\b/i,
    /\blet's do\b/i,
    /\blet's use\b/i,
    /\blet's build\b/i,
    /\blet's start\b/i,
    /\bspecifically\b/i,
    /\bthe one I\b/i,
    /\bthe approach I\b/i,
    /\bdecided\b/i,
    /\bgoing with\b/i,
    /\bcommit\b/i,
    /\block in\b/i,
    /\bfinalize\b/i,
    /\bexecute\b/i,
    /\bimplement\b/i,
    /\bbuild this\b/i
  ],

  REFINING: [
    /\btweak\b/i,
    /\badjust\b/i,
    /\bfix this\b/i,
    /\bfix that\b/i,
    /\bpolish\b/i,
    /\bbetter\b/i,
    /\bcloser to\b/i,
    /\bmore like\b/i,
    /\bless like\b/i,
    /\btoo much\b/i,
    /\btoo little\b/i,
    /\bthis part\b/i,
    /\bthis section\b/i,
    /\bchange the\b/i,
    /\btighten\b/i,
    /\bsharpen\b/i,
    /\bclean up\b/i,
    /\biterate\b/i,
    /\bversion\b/i
  ]
};

// ============================================================
// Phase Instructions (from Forge doc)
// ============================================================

const PHASE_INSTRUCTIONS = {
  DIVERGING: 'Keep the space open. Introduce unexpected material. Resist convergence.',
  INCUBATING: 'Back off. Ask one good question and shut up. Surface something from a completely different domain.',
  CONVERGING: 'Now help build. But keep testing: Does this still feel like the thing you were reaching for?',
  REFINING: 'Be a mirror. Show them what they made, not what you\'d make.'
};

// ============================================================
// Fusion Rules (affect shape × forge phase)
// ============================================================

const FUSION_RULES = [
  {
    phase: 'DIVERGING',
    condition: (affect) => affect.expansion < -0.15,
    label: 'contracted',
    instruction: 'Lower stakes before pushing for volume. Make the bad idea safe.'
  },
  {
    phase: 'DIVERGING',
    condition: (affect) => affect.activation > 0.3,
    label: 'flooding',
    instruction: 'Too many threads. Slow without closing: which one has the most charge?'
  },
  {
    phase: 'INCUBATING',
    condition: (affect) => affect.activation < -0.15,
    label: 'frozen',
    instruction: 'Gently warm. One low-stakes tangent or analogy.'
  },
  {
    phase: 'INCUBATING',
    condition: (affect) => affect.certainty > 0.3,
    label: 'certain',
    instruction: 'Possible premature convergence. Name it.'
  },
  {
    phase: 'CONVERGING',
    condition: (affect) => affect.certainty < -0.2,
    label: 'uncertain',
    instruction: 'Permission to choose imperfectly.'
  },
  {
    phase: 'REFINING',
    condition: (affect) => affect.expansion > 0.3,
    label: 'expanding',
    instruction: 'Might be avoiding editing. Redirect gently.'
  }
];

// ============================================================
// Conversation Buffer
// ============================================================

const conversationBuffer = [];
const BUFFER_SIZE = 8;

function addToBuffer(message) {
  if (!message || typeof message !== 'string') return;
  conversationBuffer.push(message);
  if (conversationBuffer.length > BUFFER_SIZE) {
    conversationBuffer.shift();
  }
}

function resetBuffer() {
  conversationBuffer.length = 0;
  console.log('[Forge] Conversation buffer reset');
}

// ============================================================
// Structural Signal Extractors
// ============================================================

/**
 * Question-to-command ratio
 * High questions = diverging/exploring
 * High commands = converging/directing
 */
function questionToCommandRatio(text) {
  const questions = (text.match(/\?/g) || []).length;
  const commands = (text.match(/\b(do|make|build|create|show|give|tell|fix|run|send|write|add|remove|delete)\b/gi) || []).length;

  if (questions === 0 && commands === 0) return 0;
  if (commands === 0) return 1;
  if (questions === 0) return -1;

  // Normalize to -1 (all commands) to +1 (all questions)
  return (questions - commands) / (questions + commands);
}

/**
 * Lexical variety (type-token ratio)
 * High TTR = exploring new territory
 * Low TTR = circling/refining
 */
function lexicalVariety(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 0;

  const uniqueWords = new Set(words);
  return uniqueWords.size / words.length;
}

/**
 * Idea density (clause counting via conjunctions and punctuation)
 * High = diverging/brainstorming
 * Low = focusing/refining
 */
function ideaDensity(text) {
  const clauses = text.split(/[,;:]|(?:\band\b|\bor\b|\bbut\b|\bbecause\b|\bso\b|\bthen\b)/i).filter(c => c.trim().length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (sentences.length === 0) return 0;
  return clauses.length / sentences.length;
}

/**
 * Reframing frequency (self-corrections, pivots)
 * High = incubating, circling
 */
function reframingFrequency(text) {
  const reframingPatterns = [
    /\bwait actually\b/i,
    /\bno what I mean\b/i,
    /\bactually no\b/i,
    /\bsorry,?\s*(I mean|let me)\b/i,
    /\bhold on\b/i,
    /\blet me rephrase\b/i,
    /\bI take that back\b/i,
    /\bscrap that\b/i,
    /\bnever\s*mind\b/i,
    /\bhmm,?\s*(wait|no|actually)\b/i
  ];

  let count = 0;
  for (const pattern of reframingPatterns) {
    if (pattern.test(text)) count++;
  }

  return count;
}

/**
 * Concreteness (specific nouns vs abstract concepts)
 * High = refining something real
 * Low = incubating/exploring
 */
function concreteness(text) {
  // Concrete markers: proper nouns, file extensions, numbers, quoted strings, technical terms
  const concretePatterns = [
    /\b[A-Z][a-z]+[A-Z]\w*\b/g,  // CamelCase
    /\b\w+\.(js|ts|py|json|html|css|md|txt)\b/gi,  // File extensions
    /\b\d+\b/g,  // Numbers
    /"[^"]+"/g,  // Quoted strings
    /'[^']+'/g,  // Single quoted strings
    /`[^`]+`/g,  // Backtick strings
    /\b(function|class|const|let|var|import|export|return)\b/gi  // Code keywords
  ];

  // Abstract markers
  const abstractPatterns = [
    /\b(something|thing|stuff|idea|concept|notion|feeling|sense|vibe)\b/gi,
    /\b(maybe|perhaps|might|could|would|should)\b/gi,
    /\b(kind of|sort of|like|basically|essentially)\b/gi
  ];

  let concreteScore = 0;
  let abstractScore = 0;

  for (const pattern of concretePatterns) {
    concreteScore += (text.match(pattern) || []).length;
  }

  for (const pattern of abstractPatterns) {
    abstractScore += (text.match(pattern) || []).length;
  }

  if (concreteScore === 0 && abstractScore === 0) return 0.5;
  return concreteScore / (concreteScore + abstractScore);
}

/**
 * Message length trajectory from buffer
 * Increasing = expanding/diverging
 * Decreasing = converging/refining
 * Stable short = focused
 * Stable long = exploring
 */
function messageLengthTrajectory() {
  if (conversationBuffer.length < 2) return 0;

  const lengths = conversationBuffer.map(m => m.length);
  const recent = lengths.slice(-3);

  if (recent.length < 2) return 0;

  // Simple linear trend
  let trend = 0;
  for (let i = 1; i < recent.length; i++) {
    trend += (recent[i] - recent[i - 1]) / Math.max(recent[i - 1], 1);
  }

  return Math.max(-1, Math.min(1, trend / recent.length));
}

// ============================================================
// Phase Scoring
// ============================================================

function countPatternMatches(text, patterns) {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) count++;
  }
  return count;
}

function scorePhases(text) {
  const scores = {
    DIVERGING: 0,
    INCUBATING: 0,
    CONVERGING: 0,
    REFINING: 0
  };

  // Pattern matching scores
  scores.DIVERGING += countPatternMatches(text, PHASE_PATTERNS.DIVERGING) * 0.15;
  scores.INCUBATING += countPatternMatches(text, PHASE_PATTERNS.INCUBATING) * 0.15;
  scores.CONVERGING += countPatternMatches(text, PHASE_PATTERNS.CONVERGING) * 0.15;
  scores.REFINING += countPatternMatches(text, PHASE_PATTERNS.REFINING) * 0.15;

  // Structural signal boosting
  const qcRatio = questionToCommandRatio(text);
  const ttr = lexicalVariety(text);
  const density = ideaDensity(text);
  const reframing = reframingFrequency(text);
  const concrete = concreteness(text);
  const trajectory = messageLengthTrajectory();

  // DIVERGING: high questions + high idea density + high lexical variety
  if (qcRatio > 0.2) scores.DIVERGING += 0.2;
  if (density > 2) scores.DIVERGING += 0.15;
  if (ttr > 0.7) scores.DIVERGING += 0.15;
  if (trajectory > 0.2) scores.DIVERGING += 0.1;

  // INCUBATING: reframing + circling language + low concreteness
  if (reframing >= 1) scores.INCUBATING += 0.25;
  if (reframing >= 2) scores.INCUBATING += 0.15;
  if (concrete < 0.3) scores.INCUBATING += 0.15;
  if (ttr < 0.5) scores.INCUBATING += 0.1;

  // CONVERGING: commands + low idea density + decision language
  if (qcRatio < -0.2) scores.CONVERGING += 0.2;
  if (density < 1.5) scores.CONVERGING += 0.15;
  if (trajectory < -0.2) scores.CONVERGING += 0.1;

  // REFINING: high concreteness + references to existing work
  if (concrete > 0.6) scores.REFINING += 0.25;
  if (concrete > 0.8) scores.REFINING += 0.15;
  // Check for "this/that/it" references suggesting existing artifact
  const referenceCount = (text.match(/\b(this|that|it)\b/gi) || []).length;
  if (referenceCount >= 3) scores.REFINING += 0.15;

  return scores;
}

function detectPhase(text) {
  const scores = scorePhases(text);

  // Find highest scoring phase
  let maxPhase = 'NEUTRAL';
  let maxScore = 0.3; // Threshold for activation

  for (const [phase, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxPhase = phase;
    }
  }

  return { phase: maxPhase, score: maxScore, scores };
}

// ============================================================
// Axis Calculation
// ============================================================

/**
 * Calculate openness (0-1)
 * 1 = keep space open (diverging)
 * 0 = help close/build (converging)
 */
function calculateOpenness(scores) {
  const divergeSignal = scores.DIVERGING + scores.INCUBATING * 0.5;
  const convergeSignal = scores.CONVERGING + scores.REFINING * 0.5;

  if (divergeSignal === 0 && convergeSignal === 0) return 0.5;

  const openness = divergeSignal / (divergeSignal + convergeSignal);
  return Math.round(openness * 100) / 100;
}

/**
 * Calculate materiality (0-1)
 * 1 = concrete, something exists (refining)
 * 0 = abstract, nothing exists yet (incubating)
 */
function calculateMateriality(scores, text) {
  const concrete = concreteness(text);
  const abstractSignal = scores.INCUBATING + scores.DIVERGING * 0.3;
  const concreteSignal = scores.REFINING + scores.CONVERGING * 0.3;

  // Weight concrete score highly
  const materiality = (concreteSignal * 0.4 + concrete * 0.6) /
    (abstractSignal * 0.4 + (1 - concrete) * 0.3 + concreteSignal * 0.4 + concrete * 0.6 + 0.001);

  return Math.round(Math.max(0, Math.min(1, materiality)) * 100) / 100;
}

// ============================================================
// Complement Generation
// ============================================================

function generateComplement(phase, openness, materiality, affectShape) {
  const parts = [];

  parts.push('[FORGE COMPLEMENT]');
  parts.push(`Shape: openness=${openness}, materiality=${materiality}`);
  parts.push(`Phase: ${phase}`);

  if (phase === 'NEUTRAL') {
    parts.push('No active modulation — neutral creative container.');
    parts.push('[END FORGE COMPLEMENT]');
    return parts.join('\n');
  }

  // Add phase instruction
  if (PHASE_INSTRUCTIONS[phase]) {
    parts.push('');
    parts.push(PHASE_INSTRUCTIONS[phase]);
  }

  // Apply fusion rules if affect shape provided
  if (affectShape && typeof affectShape === 'object') {
    for (const rule of FUSION_RULES) {
      if (rule.phase === phase && rule.condition(affectShape)) {
        parts.push('');
        parts.push(`[Affect fusion: ${rule.label}] ${rule.instruction}`);
        break; // Only apply first matching rule
      }
    }
  }

  parts.push('[END FORGE COMPLEMENT]');
  return parts.join('\n');
}

// ============================================================
// Main Detection Entry Point
// ============================================================

/**
 * Detect creative phase from message and generate complement
 *
 * @param {string} message - Current user message
 * @param {Object} affectShape - Optional affect shape {expansion, activation, certainty}
 * @returns {Object} { block, phase, openness, materiality }
 */
function detect(message, affectShape = null) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      block: '[FORGE COMPLEMENT]\nShape: openness=0.5, materiality=0.5\nPhase: NEUTRAL\nNo active modulation — neutral creative container.\n[END FORGE COMPLEMENT]',
      phase: 'NEUTRAL',
      openness: 0.5,
      materiality: 0.5
    };
  }

  const text = message.trim();

  // Add to conversation buffer for trajectory analysis
  addToBuffer(text);

  // Analyze combined buffer for phase detection
  const combinedText = conversationBuffer.join(' ');
  const { phase, scores } = detectPhase(combinedText);

  // Calculate output axes
  const openness = calculateOpenness(scores);
  const materiality = calculateMateriality(scores, combinedText);

  // Generate complement block
  const block = generateComplement(phase, openness, materiality, affectShape);

  console.log('[Forge]', `phase=${phase}`, `openness=${openness}`, `materiality=${materiality}`,
    affectShape ? `affect: exp=${affectShape.expansion} act=${affectShape.activation} cert=${affectShape.certainty}` : '');

  return {
    block,
    phase,
    openness,
    materiality
  };
}

// ============================================================
// Exports
// ============================================================

// Browser export (page context)
if (typeof window !== 'undefined') {
  window.HearthForgeDetector = {
    detect,
    reset: resetBuffer,
    // Expose internals for testing
    _scorePhases: scorePhases,
    _detectPhase: detectPhase,
    _calculateOpenness: calculateOpenness,
    _calculateMateriality: calculateMateriality,
    _questionToCommandRatio: questionToCommandRatio,
    _lexicalVariety: lexicalVariety,
    _ideaDensity: ideaDensity,
    _reframingFrequency: reframingFrequency,
    _concreteness: concreteness,
    _getBuffer: () => [...conversationBuffer],
    PHASE_PATTERNS,
    PHASE_INSTRUCTIONS,
    FUSION_RULES
  };
  console.log('[Forge] HearthForgeDetector loaded');
}

// Node/CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detect,
    reset: resetBuffer,
    scorePhases,
    detectPhase,
    calculateOpenness,
    calculateMateriality,
    questionToCommandRatio,
    lexicalVariety,
    ideaDensity,
    reframingFrequency,
    concreteness,
    PHASE_PATTERNS,
    PHASE_INSTRUCTIONS,
    FUSION_RULES
  };
}
