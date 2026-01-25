/**
 * Behavioral Verb Pattern Taxonomy
 *
 * These patterns detect HOW users do things (behavioral invariants),
 * not WHAT they've done (content/nouns).
 *
 * Each pattern has:
 * - patterns: Array of regex to match in memory content
 * - verb: Human-readable description of the behavior
 * - application: Intervention suggestion for the Judge
 * - queryBridges: Regex patterns indicating this pattern is relevant to current query
 * - contradictionBridges: Regex patterns indicating counter-evidence to this pattern
 */

const BEHAVIORAL_VERB_PATTERNS = {
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
    queryBridges: [
      /should I/i,
      /can't decide/i,
      /stuck/i,
      /options/i,
      /which (one|to choose|should)/i,
      /torn between/i,
      /weighing/i,
      /pros and cons/i
    ],
    contradictionBridges: [
      /decided quickly/i,
      /made (a |the )?decision (without|easily|fast|quickly)/i,
      /didn't overthink/i,
      /went with (my |first )?(gut|instinct)/i,
      /narrowed (it |options )?(down )?immediately/i,
      /no (hesitation|indecision)/i,
      /chose (quickly|easily|confidently|immediately)/i,
      /just (picked|chose|decided)/i,
      /trusted my (gut|instinct|first choice)/i
    ]
  },

  momentum_through_building: {
    patterns: [
      /break(s|ing)?\s*(through|out)?\s*(by|via|through)?\s*(build|mak|creat)/i,
      /momentum (through|via|by) (building|making|creating)/i,
      /action over planning/i,
      /build(ing)? (to|for) (think|understand|clarity)/i,
      /prototype (first|to think)/i,
      /learn(s|ed|ing)? by (doing|building|making)/i,
      /make (it|something) (concrete|real|tangible)/i,
      /stop planning.*(start|just) (build|do|make)/i,
      /hands.?on (learn|approach|process)/i,
      /tangible (progress|output|result)/i
    ],
    verb: 'builds momentum through making',
    application: 'action over planning',
    queryBridges: [
      /stuck/i,
      /can't start/i,
      /procrastinat/i,
      /not (making|seeing) progress/i,
      /how (do I|to) (begin|start)/i,
      /spinning/i,
      /planning too/i
    ],
    contradictionBridges: [
      /planned (carefully|thoroughly|extensively|first)/i,
      /outlined everything (before|first)/i,
      /didn't (start|build|make) until/i,
      /research(ed)? (extensively|thoroughly) (before|first)/i,
      /waited (until|to) (plan|outline|research|understand)/i,
      /thought it through (first|before)/i,
      /planned (before|then) (built|made|acted)/i,
      /planning (helped|worked|was key)/i
    ]
  },

  externalization_for_clarity: {
    patterns: [
      /external(iz|is)(e|ed|es|ing)/i,
      /spatial (form|layout|representation)/i,
      /visual(iz|is)(e|ed|ing)/i,
      /draw(ing)? (it )?(out|up)/i,
      /whiteboard/i,
      /diagram(ming|med)?/i,
      /map(ping|ped)? (it |things )?(out|up)/i,
      /make (it |things )?(visible|concrete|tangible)/i,
      /see (it |things )?laid out/i,
      /physical (representation|form|space)/i,
      /post.?it/i,
      /sticky notes/i,
      /spread.*(out|around)/i
    ],
    verb: 'externalizes to clarify',
    application: 'make abstract concrete',
    queryBridges: [
      /confused/i,
      /complex/i,
      /can't understand/i,
      /too abstract/i,
      /hard to (grasp|follow|see)/i,
      /overwhelming/i,
      /messy/i,
      /tangled/i
    ],
    contradictionBridges: [
      /figured it out (in my head|mentally|internally)/i,
      /didn't need to (write|draw|visualize)/i,
      /kept it (all )?in (my )?head/i,
      /thought (it )?through (mentally|internally)/i,
      /no need (to|for) (diagram|map|draw|visualize)/i,
      /understood without (writing|drawing|visualizing)/i,
      /clarity came (mentally|internally|from thinking)/i
    ]
  },

  constraint_as_liberation: {
    patterns: [
      /constraint(s)? (as|for|bring|create) (liberation|freedom|momentum)/i,
      /artificial (limit|constraint|deadline|boundary)/i,
      /limit(s|ing|ed)? (to|for) (focus|clarity|momentum)/i,
      /deadline (helps|works|creates)/i,
      /box(es|ing)? (self|myself|in)/i,
      /narrow(ed|ing)? (focus|scope|options)/i,
      /less (options|choice) (helps|works|better)/i,
      /thrive(s)? (with|under) (constraint|limit|pressure)/i,
      /structure (helps|creates|brings)/i,
      /rules (help|create|bring)/i,
      /boundaries (help|create|bring)/i
    ],
    verb: 'gains momentum through constraint',
    application: 'add artificial limits',
    queryBridges: [
      /too many/i,
      /overwhelmed/i,
      /no direction/i,
      /scattered/i,
      /unfocused/i,
      /everywhere at once/i,
      /can't focus/i,
      /where to start/i
    ],
    contradictionBridges: [
      /constraints (felt|were) (limiting|restrictive|suffocating)/i,
      /needed (more|full) freedom/i,
      /rules (held back|blocked|hindered)/i,
      /thrived (with|in) (freedom|openness|no limits)/i,
      /better without (constraints|limits|rules|structure)/i,
      /open.?ended (worked|helped|was better)/i,
      /removing (constraints|limits) (helped|freed)/i,
      /too (constrained|limited|restricted)/i
    ]
  },

  avoidance_through_research: {
    patterns: [
      /avoid(ing|ance)?\s*(through|via|by)?\s*(research|prep|learn)/i,
      /delay(s|ed|ing)?\s*(through|via|by)?\s*(research|prep|learn)/i,
      /endless (preparation|research|learning)/i,
      /not ready (yet|to)/i,
      /need(s)? (more|additional) (info|research|prep)/i,
      /one more (article|book|course|video)/i,
      /still (researching|learning|preparing)/i,
      /knowledge (hoarding|collecting)/i,
      /preparation (loop|spiral|trap)/i,
      /afraid to (start|act|do) (without|until)/i
    ],
    verb: 'delays through endless preparation',
    application: 'act with incomplete info',
    queryBridges: [
      /not ready/i,
      /need more (info|research)/i,
      /research/i,
      /prepare/i,
      /should I (learn|study|read) (more|first)/i,
      /don't know enough/i,
      /before I (start|begin)/i
    ],
    contradictionBridges: [
      /acted (without|with incomplete|before finishing)/i,
      /started (before|without) (ready|knowing|understanding)/i,
      /jumped (in|right in)/i,
      /learned (by doing|as I went|on the job)/i,
      /figured it out (along the way|as I went)/i,
      /didn't (need to|) research (first|beforehand)/i,
      /enough (info|knowledge|preparation)/i,
      /ready (enough|to act|to start)/i
    ]
  },

  recovery_through_isolation: {
    patterns: [
      /recover(s|y|ed|ing)?\s*(through|via|by)?\s*(isolation|alone|solitude)/i,
      /recharge(s|d|ing)?\s*(alone|by myself|in solitude)/i,
      /need(s)? (to be |time )?(alone|solitude|space)/i,
      /introvert(ed)?/i,
      /social(ly)? drain(ed|ing|s)/i,
      /people exhaust(s|ed|ing)?/i,
      /alone time/i,
      /quiet (time|space|place)/i,
      /withdraw(n|ing|s)? to (recharge|recover)/i,
      /hermit (mode|time)/i
    ],
    verb: 'recovers through isolation',
    application: 'protect recovery time',
    queryBridges: [
      /exhausted/i,
      /drained/i,
      /need space/i,
      /overwhelmed/i,
      /too much (people|social)/i,
      /tired/i,
      /burned out/i,
      /depleted/i
    ],
    contradictionBridges: [
      /recharged (by|through|with) (people|friends|socializing)/i,
      /felt better after (talking|socializing|being with)/i,
      /people (energized|recharged|helped) me/i,
      /needed (company|connection|people) to (recover|feel better)/i,
      /isolation (made it|felt) worse/i,
      /being alone (didn't help|felt wrong|made it worse)/i,
      /social(izing)? (helped|recharged|energized)/i
    ]
  },

  recovery_through_connection: {
    patterns: [
      /recover(s|y|ed|ing)?\s*(through|via|by)?\s*(connect|talk|people)/i,
      /process(es|ed|ing)?\s*(through|by|via)?\s*talk(ing)?/i,
      /need(s)? to (talk|vent|share|connect)/i,
      /extrovert(ed)?/i,
      /people (energize|recharge|help)/i,
      /talk(ing)? (it )?(out|through)/i,
      /verbal process/i,
      /think(s|ing)? (out loud|by talking)/i,
      /sound(ing)? board/i,
      /need(s)? (a|someone to) (listen|hear|talk)/i
    ],
    verb: 'recovers through connection',
    application: 'facilitate talking',
    queryBridges: [
      /lonely/i,
      /processing/i,
      /need to talk/i,
      /isolated/i,
      /stuck in (my|own) head/i,
      /no one to (talk|listen)/i,
      /want to (share|vent|discuss)/i
    ],
    contradictionBridges: [
      /processed (it )?(alone|internally|in my head)/i,
      /didn't need to (talk|vent|share)/i,
      /figured it out (alone|by myself|on my own)/i,
      /talking (didn't help|made it worse|was exhausting)/i,
      /needed (quiet|silence|solitude) to (process|think|recover)/i,
      /felt better after (being alone|quiet time|solitude)/i,
      /alone time (helped|was what I needed)/i
    ]
  },

  closure_seeking: {
    patterns: [
      /seek(s|ing)? (rapid |quick )?(closure|resolution)/i,
      /need(s)? to know (now|immediately|right away)/i,
      /can't (stand|handle|tolerate) uncertainty/i,
      /hate(s)? (waiting|uncertainty|not knowing)/i,
      /need(s)? (clear |definitive )?(answer|decision|resolution)/i,
      /closure (need|seeking|required)/i,
      /open loop(s)? (stress|bother|anxiety)/i,
      /unresolved (stress|bother|anxiety)/i,
      /must (finish|complete|close|resolve)/i,
      /wrap(ping)? (it |things )?(up|off)/i
    ],
    verb: 'seeks rapid closure',
    application: 'provide clear next steps',
    queryBridges: [
      /need to know/i,
      /uncertainty/i,
      /waiting/i,
      /when will/i,
      /what happens (next|if)/i,
      /can't (wait|stand) (not knowing|uncertainty)/i,
      /open (loop|ended|question)/i
    ],
    contradictionBridges: [
      /comfortable (with|in) uncertainty/i,
      /okay (with|not knowing|waiting)/i,
      /let it (sit|remain|stay) (open|unresolved)/i,
      /didn't need (closure|resolution|answers) (right away|immediately)/i,
      /patient (with|about) (uncertainty|not knowing|waiting)/i,
      /ambiguity (was fine|didn't bother|was okay)/i,
      /open.?ended (was fine|felt okay|worked)/i,
      /embraced (uncertainty|ambiguity|not knowing)/i
    ]
  }
};

// Pre-compile all patterns at load time for performance
const COMPILED_PATTERNS = {};
for (const [patternId, config] of Object.entries(BEHAVIORAL_VERB_PATTERNS)) {
  COMPILED_PATTERNS[patternId] = {
    ...config,
    compiledPatterns: config.patterns,
    compiledBridges: config.queryBridges,
    compiledContradictionBridges: config.contradictionBridges || []
  };
}

/**
 * Check if a memory matches any behavioral verb pattern
 * @param {string} content - Memory content to analyze
 * @returns {Array<{patternId: string, verb: string, application: string}>}
 */
function detectPatternsInMemory(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const matches = [];

  for (const [patternId, config] of Object.entries(COMPILED_PATTERNS)) {
    for (const pattern of config.compiledPatterns) {
      if (pattern.test(content)) {
        matches.push({
          patternId,
          verb: config.verb,
          application: config.application
        });
        break; // Only count once per pattern type
      }
    }
  }

  return matches;
}

/**
 * Check if a query matches any pattern's query bridges
 * @param {string} query - User's current query
 * @param {string} patternId - Pattern ID to check
 * @returns {boolean}
 */
function queryMatchesBridges(query, patternId) {
  if (!query || !patternId) return false;

  const config = COMPILED_PATTERNS[patternId];
  if (!config) return false;

  for (const bridge of config.compiledBridges) {
    if (bridge.test(query)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect contradictions to behavioral patterns in a message
 * @param {string} message - User's message to check for contradictions
 * @returns {Array<{patternId: string, strength: 'weak'|'normal'|'strong'}>}
 */
function detectContradictions(message) {
  if (!message || typeof message !== 'string') {
    return [];
  }

  const contradictions = [];

  for (const [patternId, config] of Object.entries(COMPILED_PATTERNS)) {
    if (!config.compiledContradictionBridges || config.compiledContradictionBridges.length === 0) {
      continue;
    }

    let matchCount = 0;
    for (const bridge of config.compiledContradictionBridges) {
      if (bridge.test(message)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      // More matches = stronger contradiction
      let strength = 'normal';
      if (matchCount >= 3) strength = 'strong';
      else if (matchCount === 1) strength = 'weak';

      contradictions.push({
        patternId,
        strength,
        matchCount
      });
    }
  }

  return contradictions;
}

/**
 * Check if a message contradicts a specific pattern
 * @param {string} message - User's message
 * @param {string} patternId - Pattern ID to check
 * @returns {boolean}
 */
function messageContradictsPattern(message, patternId) {
  if (!message || !patternId) return false;

  const config = COMPILED_PATTERNS[patternId];
  if (!config || !config.compiledContradictionBridges) return false;

  for (const bridge of config.compiledContradictionBridges) {
    if (bridge.test(message)) {
      return true;
    }
  }

  return false;
}

// Export for module use (not used in page context, but for testing/documentation)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BEHAVIORAL_VERB_PATTERNS,
    COMPILED_PATTERNS,
    detectPatternsInMemory,
    queryMatchesBridges,
    detectContradictions,
    messageContradictsPattern
  };
}
