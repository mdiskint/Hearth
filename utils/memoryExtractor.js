/**
 * Memory Extractor for Hearth
 * Heuristic pattern matching to identify memory-worthy conversation content
 */

const MEMORY_PATTERNS = [
  // Self-disclosure
  /\bI prefer\b/i,
  /\bI always\b/i,
  /\bI never\b/i,
  /\bI am a\b/i,
  /\bI have a\b/i,
  // Emotional
  /\bI feel\b/i,
  /\bI want\b/i,
  /\bI need\b/i,
  // Decision
  /\bI decided\b/i,
  /\bI chose\b/i,
  // Reference
  /\byou mentioned\b/i
];

/**
 * Check if text contains memory-worthy content
 * @param {string} text
 * @returns {boolean}
 */
function isMemoryWorthy(text) {
  if (!text || typeof text !== 'string') return false;
  return MEMORY_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Derive memory_class from type: patterns encode process, facts encode content.
 */
function deriveMemoryClass(type) {
  const PATTERN_TYPES = ['value', 'partner_model', 'synthesis', 'self_model', 'reward'];
  return PATTERN_TYPES.includes(type) ? 'pattern' : 'fact';
}

/**
 * Extract a memory candidate from a conversation message
 * @param {{role: string, content: string}} message
 * @returns {{content: string, source: string, created_at: string, type: string, memory_class: string}}
 */
function extractMemoryCandidate(message) {
  const type = 'fact';
  return {
    content: message.content,
    source: 'conversation',
    created_at: new Date().toISOString(),
    type,
    memory_class: deriveMemoryClass(type)
  };
}

// Export for browser context
if (typeof window !== 'undefined') {
  window.HearthMemoryExtractor = { isMemoryWorthy, extractMemoryCandidate };
}
