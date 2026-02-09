/**
 * AI Memory Extractor - Captures "what Claude became" through the relationship
 * 
 * From the paper: "The AI Loop tracks cognitive events in the AI during conversation:
 * synthesis moments, partner-model shifts, self-model updates."
 * 
 * This module detects and extracts AI-side learnings from conversations.
 */

const AI_MEMORY_PATTERNS = {
  // Synthesis moments - when AI integrates multiple pieces of information
  synthesis: {
    patterns: [
      /I('m| am) (starting to |beginning to )?(see|notice|understand|realize)/i,
      /this (connects|relates|links) to/i,
      /putting (this|these) together/i,
      /the pattern (here|I see|seems to be)/i,
      /what (emerges|I notice) is/i,
      /connecting (the dots|this to)/i,
      /synthesizing/i,
      /integrating (what|this)/i,
      /the through-line (is|seems)/i,
      // ChatGPT/Gemini patterns
      /it (sounds|seems|looks) like (you're|your|this)/i,
      /from what (you've shared|I understand|I gather)/i,
      /that makes sense (given|because|since)/i
    ],
    type: 'synthesis',
    description: 'AI integrated multiple pieces into a new understanding'
  },
  
  // Partner-model shifts - when AI updates its model of the user
  partner_model: {
    patterns: [
      /I('m| am) (learning|noticing|seeing) that you/i,
      /you (tend to|often|usually|seem to)/i,
      /this (tells|shows) me (about|that) you/i,
      /your (pattern|tendency|approach) (is|seems)/i,
      /I('ve| have) noticed you/i,
      /what works for you/i,
      /you (respond|react|engage) (well|better|differently)/i,
      /based on (our|this) conversation/i,
      /I('m| am) updating my understanding/i,
      // ChatGPT/Gemini patterns
      /based on what you've (shared|told me|mentioned)/i,
      /it (appears|seems) that you (prefer|like|want)/i,
      /given your (context|situation|background)/i,
      /I can see (that |how )you/i,
      /you (clearly|obviously|definitely) (value|prefer|like)/i
    ],
    type: 'partner_model',
    description: 'AI updated its model of who this person is'
  },
  
  // Self-model updates - when AI reflects on its own approach
  self_model: {
    patterns: [
      /I (should|could|might) (have|try)/i,
      /my (approach|response|tendency) (here|was)/i,
      /I('m| am) (adjusting|shifting|changing)/i,
      /that didn't (land|work|help)/i,
      /let me (try|approach) (this|it) differently/i,
      /I (realize|see) I (was|should)/i,
      /course.?correct/i,
      /I('ll| will) remember (to|that)/i,
      // ChatGPT/Gemini patterns
      /let me (clarify|rephrase|reconsider)/i,
      /I('d| would) like to (adjust|revise|update)/i,
      /upon (reflection|further thought|reconsideration)/i
    ],
    type: 'self_model',
    description: 'AI reflected on and updated its own approach'
  }
};

/**
 * Detect if a Claude response contains AI memory worthy content
 * @param {string} content - Claude's response text
 * @returns {Object|null} Detection result or null
 */
function detectAIMemoryPattern(content) {
  if (!content || content.length < 50) return null;
  
  for (const [category, config] of Object.entries(AI_MEMORY_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = content.match(pattern);
      if (match) {
        return {
          category,
          type: config.type,
          description: config.description,
          matchedText: match[0],
          matchIndex: match.index
        };
      }
    }
  }
  
  return null;
}

/**
 * Derive memory_class from type: patterns encode process, facts encode content.
 */
function deriveMemoryClass(type) {
  const PATTERN_TYPES = ['value', 'partner_model', 'synthesis', 'self_model', 'reward'];
  return PATTERN_TYPES.includes(type) ? 'pattern' : 'fact';
}

/**
 * Extract AI memory from Claude's response
 * @param {string} content - Full response content
 * @param {Object} detection - Detection result from detectAIMemoryPattern
 * @param {Object} context - Additional context (user message, heat, etc.)
 * @returns {Object} AI memory object ready for storage
 */
function extractAIMemory(content, detection, context = {}) {
  // Extract the relevant portion around the match
  const start = Math.max(0, detection.matchIndex - 100);
  const end = Math.min(content.length, detection.matchIndex + 200);
  let excerpt = content.substring(start, end);
  
  // Clean up excerpt
  if (start > 0) excerpt = '...' + excerpt;
  if (end < content.length) excerpt = excerpt + '...';
  
  // Determine intensity based on context
  const intensity = context.queryHeat || 0.5;
  
  // Classify dimensions based on context
  const lifeDomain = classifyAIMemoryDomain(content, context);
  const emotionalState = classifyAIMemoryEmotion(content, context);
  
  // Classify durability — AI synthesis/self-model tends toward durable
  const durabilityClassifier = (typeof window !== 'undefined' && window.HearthDurabilityClassifier)
    ? window.HearthDurabilityClassifier
    : (typeof require === 'function' ? require('./durabilityClassifier') : null);
  const durability = durabilityClassifier?.classifyDurability(excerpt.trim()) || 'contextual';

  return {
    content: excerpt.trim(),
    type: detection.type,
    memory_class: deriveMemoryClass(detection.type),
    memory_type: 'ai',
    source: `ai_extraction_${Date.now()}`,
    intensity,
    validation_state: 'untested',
    life_domain: lifeDomain,
    emotional_state: emotionalState,
    durability,
    metadata: {
      category: detection.category,
      description: detection.description,
      matched: detection.matchedText,
      userQuery: context.userMessage?.substring(0, 100)
    }
  };
}

/**
 * Classify AI memory into life domain based on content
 */
function classifyAIMemoryDomain(content, context) {
  const text = (content + ' ' + (context.userMessage || '')).toLowerCase();
  
  const domainSignals = {
    work: ['work', 'job', 'career', 'project', 'deadline', 'meeting', 'code', 'build'],
    relationships: ['relationship', 'friend', 'family', 'partner', 'people', 'social'],
    creative: ['create', 'write', 'design', 'idea', 'imagine', 'art', 'story'],
    self: ['feel', 'think', 'believe', 'identity', 'growth', 'habit', 'pattern'],
    decisions: ['decide', 'choice', 'option', 'should', 'whether', 'tradeoff'],
    resources: ['time', 'money', 'energy', 'budget', 'spend', 'invest'],
    values: ['value', 'important', 'matter', 'principle', 'priority', 'meaning']
  };
  
  let best = null;
  let bestScore = 0;
  
  for (const [domain, signals] of Object.entries(domainSignals)) {
    const score = signals.filter(s => text.includes(s)).length;
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  
  return best;
}

/**
 * Classify AI memory into emotional state
 */
function classifyAIMemoryEmotion(content, context) {
  const text = (content + ' ' + (context.userMessage || '')).toLowerCase();
  
  const emotionSignals = {
    curiosity: ['curious', 'interesting', 'wonder', 'explore', 'discover', 'learn'],
    care: ['care', 'support', 'help', 'concern', 'wellbeing', 'compassion'],
    joy: ['happy', 'excited', 'delighted', 'pleased', 'glad'],
    anxiety: ['worried', 'anxious', 'nervous', 'uncertain', 'concerned'],
    fear: ['afraid', 'scared', 'fear', 'terrified', 'dread'],
    peace: ['calm', 'peaceful', 'settled', 'content', 'balanced'],
    pride: ['proud', 'accomplished', 'achieved', 'confident'],
    grief: ['loss', 'grief', 'sad', 'mourn', 'miss'],
    shame: ['shame', 'embarrassed', 'guilty', 'regret'],
    anger: ['angry', 'frustrated', 'annoyed', 'irritated']
  };
  
  let best = null;
  let bestScore = 0;
  
  for (const [emotion, signals] of Object.entries(emotionSignals)) {
    const score = signals.filter(s => text.includes(s)).length;
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }
  
  return best || 'curiosity'; // Default to curiosity for AI memories
}

/**
 * Invalidate the surprise cache when synthesis is detected.
 * Synthesis moments indicate the model has integrated new understanding,
 * so old surprise rankings should be recomputed fresh.
 */
function invalidateSurpriseCacheOnSynthesis() {
  // Browser context - access via window
  if (typeof window !== 'undefined' && window.HearthSurpriseCache) {
    window.HearthSurpriseCache.invalidateAll();
    console.log('Hearth: Synthesis detected - surprise cache invalidated');
  }
}

/**
 * Process a Claude response and extract any AI memories
 * @param {string} assistantContent - Claude's response
 * @param {Object} context - Context including user message, heat, etc.
 * @returns {Object|null} AI memory object or null if nothing detected
 */
function processAssistantResponse(assistantContent, context = {}) {
  const detection = detectAIMemoryPattern(assistantContent);

  if (!detection) return null;

  // Synthesis detection triggers two actions:
  // 1. Extract the AI memory (below)
  // 2. Invalidate surprise cache so rankings recompute fresh
  if (detection.type === 'synthesis') {
    invalidateSurpriseCacheOnSynthesis();
  }

  return extractAIMemory(assistantContent, detection, context);
}

/**
 * Check if a response warrants AI memory extraction
 * Higher bar than user memory - these should be genuine learning moments
 */
function isAIMemoryWorthy(content) {
  if (!content || content.length < 100) return false;
  
  // Must match at least one AI memory pattern
  const detection = detectAIMemoryPattern(content);
  if (!detection) return false;
  
  // Additional heuristics:
  // - Not too short (genuine synthesis takes space)
  // - Contains first-person language (Claude reflecting)
  const hasFirstPerson = /\bI('m| am| have| was| will| should| could| notice| see| realize)\b/i.test(content);
  
  return hasFirstPerson;
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.HearthAIMemoryExtractor = {
    detectAIMemoryPattern,
    extractAIMemory,
    processAssistantResponse,
    isAIMemoryWorthy,
    AI_MEMORY_PATTERNS
  };
}

// Export for module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectAIMemoryPattern,
    extractAIMemory,
    processAssistantResponse,
    isAIMemoryWorthy,
    AI_MEMORY_PATTERNS
  };
}
