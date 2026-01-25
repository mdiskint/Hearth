// This script runs in the page context to intercept fetch calls
(function() {
  'use strict';

  // Data received from injector.js
  let hearthData = null;

  // Memory type categories
  const USER_MEMORY_TYPES = ['fact', 'value', 'reward'];
  const AI_MEMORY_TYPES = ['synthesis', 'partner_model', 'self_model'];

  // Listen for data via postMessage (CSP-safe)
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'HEARTH_DATA') {
      hearthData = event.data;
      console.log('Hearth: Data received via postMessage');
      console.log('Hearth: Memories count:', hearthData.memories?.length || 0);
      console.log('Hearth: Has OpenAI key:', !!hearthData.openaiApiKey);
      console.log('Hearth: Pattern evidence:', Object.keys(hearthData.patternEvidence || {}).length, 'patterns');
    }
  });

  // ============== Heat Detection (inline for page context) ==============

  /**
   * Heat patterns organized by intensity level
   */
  const HEAT_PATTERNS = {
    // HOT (0.6 - 1.0): Crisis, anxiety, deep personal struggles
    hot: {
      baseScore: 0.6,
      maxScore: 1.0,
      patterns: [
        /\b(crisis|emergency|urgent|desperate|can't cope|falling apart)\b/i,
        /\b(suicidal|self.?harm|want to die|end it all|no way out)\b/i,
        /\b(panic|panicking|panic attack|can't breathe|heart racing)\b/i,
        /\b(terrified|petrified|paralyzed|frozen|dread)\b/i,
        /\b(overwhelming|can't handle|too much|breaking down)\b/i,
        /\b(don't know what to do|lost|hopeless|helpless|worthless)\b/i,
        /\b(failing|failure|screwed up|ruined|destroyed)\b/i,
        /\b(hate myself|hate my life|can't go on|giving up)\b/i,
        /\b(betrayed|abandoned|alone|no one understands)\b/i,
        /\b(divorce|cheating|affair|leaving me|broke up)\b/i,
        /\b(abusive|toxic|manipulative|gaslighting)\b/i,
        /\b(fired|laid off|lost my job|evicted|homeless)\b/i,
        /\b(diagnosed|terminal|dying|death|grief|mourning)\b/i,
        /\b(addiction|relapse|rock bottom)\b/i
      ]
    },

    // WARM (0.3 - 0.6): Decisions, changes, moderate emotional weight
    warm: {
      baseScore: 0.3,
      maxScore: 0.6,
      patterns: [
        /\b(thinking about|considering|debating|torn between)\b/i,
        /\b(should I|what should I|do you think I should)\b/i,
        /\b(pros and cons|weighing options|difficult decision)\b/i,
        /\b(not sure if|can't decide|conflicted)\b/i,
        /\b(career change|new job|job offer|promotion)\b/i,
        /\b(moving|relocating|new city|leaving)\b/i,
        /\b(relationship|dating|getting married|having kids)\b/i,
        /\b(starting|quitting|beginning|ending)\b/i,
        /\b(struggling with|working on|trying to)\b/i,
        /\b(frustrated|confused|uncertain|worried|anxious)\b/i,
        /\b(need advice|need help|seeking guidance)\b/i,
        /\b(want to improve|want to change|want to grow)\b/i,
        /\b(believe in|values|principles|what matters)\b/i,
        /\b(who I am|identity|purpose|meaning)\b/i,
        /\b(feel like|feeling|emotions|emotional)\b/i,
        /\b(conversation with|talk to|communicate|conflict)\b/i,
        /\b(family|parent|sibling|friend|partner)\b/i,
        /\b(boundaries|expectations|trust)\b/i
      ]
    },

    // COOL (0.1 - 0.3): Factual, how-to, informational
    cool: {
      baseScore: 0.1,
      maxScore: 0.3,
      patterns: [
        /\b(how do I|how to|how can I|how would I)\b/i,
        /\b(what's the|what is the|what are the)\b/i,
        /\b(where can I|where do I|where is)\b/i,
        /\b(when should I|when do I|when is)\b/i,
        /\b(help me with|help me understand|explain)\b/i,
        /\b(can you show|can you help|can you explain)\b/i,
        /\b(teach me|learn about|understand)\b/i,
        /\b(looking for|searching for|trying to find)\b/i,
        /\b(difference between|compare|comparison)\b/i,
        /\b(recommend|suggestion|best way to)\b/i,
        /\b(example|examples|sample|template)\b/i,
        /\b(code|programming|software|app|website)\b/i,
        /\b(fix|solve|debug|error|issue|problem)\b/i,
        /\b(create|build|make|write|generate)\b/i,
        /\b(steps|process|procedure|guide)\b/i
      ]
    },

    // COLD (0 - 0.1): Greetings, simple requests, casual
    cold: {
      baseScore: 0.0,
      maxScore: 0.1,
      patterns: [
        /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i,
        /\b(how are you|what's up|howdy)\b/i,
        /^(thanks|thank you|thx|ty)\b/i,
        /^(ok|okay|sure|got it|sounds good)\b/i,
        /^(yes|no|maybe|correct|right|wrong)\b/i,
        /\b(makes sense|I see|understood|noted)\b/i,
        /\b(testing|test|ignore|never mind|nvm)\b/i,
        /\b(just wondering|curious|random question)\b/i
      ]
    }
  };

  /**
   * Intensity boosters
   */
  const INTENSITY_BOOSTERS = [
    { pattern: /\b(really|very|extremely|incredibly|absolutely|totally)\b/i, boost: 0.1 },
    { pattern: /\b(always|never|every time|constantly)\b/i, boost: 0.08 },
    { pattern: /\b(need to|have to|must|can't)\b/i, boost: 0.05 },
    { pattern: /!{2,}/g, boost: 0.1 },
    { pattern: /\?{2,}/g, boost: 0.05 },
    { pattern: /\b[A-Z]{3,}\b/g, boost: 0.05 }
  ];

  // ============== Confidence Calibration Config (inline for page context) ==============

  /**
   * Confidence calibration configuration
   * All thresholds and weights in one place for tuning
   */
  const CONFIDENCE_CONFIG = {
    DECAY: {
      RECENT_DAYS: 30,
      STALE_DAYS: 90,
      DORMANT_DAYS: 120,
      RECENT_WEIGHT: 1.0,
      STALE_WEIGHT: 0.5,
      OLD_WEIGHT: 0.25
    },
    CONTRADICTION: {
      RECENT_DAYS: 14,
      STRENGTH_MULTIPLIER: { weak: 1.5, normal: 1.75, strong: 2.0 },
      BASE_PENALTY: 0.15,
      OVERRIDE_REQUIRES_SUPPORTS: 3
    },
    LEVELS: { HIGH: 0.70, MEDIUM: 0.40, LOW: 0.20, DORMANT: 0.10 },
    SCORING: {
      INSTANCE_COUNT: { 1: 0.10, 2: 0.20, 3: 0.30, 4: 0.40 },
      CROSS_DOMAIN: { 2: 0.15, 3: 0.25 },
      QUERY_RELEVANCE: 0.25,
      RECENCY_BONUS: 0.15
    }
  };

  /**
   * Detect the emotional heat/intensity of a query message
   * @param {string} message - The user's message text
   * @returns {number} Heat score between 0.0 and 1.0
   */
  function detectQueryHeat(message) {
    if (!message || typeof message !== 'string') {
      return 0.0;
    }

    const text = message.trim();
    if (text.length === 0) {
      return 0.0;
    }

    // Track matches by category
    const matches = { hot: 0, warm: 0, cool: 0, cold: 0 };

    // Count pattern matches in each category
    for (const [category, config] of Object.entries(HEAT_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (text.match(pattern)) {
          matches[category]++;
        }
      }
    }

    // Determine primary category and base score
    let baseScore = 0.0;
    let maxScore = 0.1;

    if (matches.hot > 0) {
      baseScore = HEAT_PATTERNS.hot.baseScore;
      maxScore = HEAT_PATTERNS.hot.maxScore;
      baseScore = Math.min(baseScore + (matches.hot - 1) * 0.1, maxScore);
    } else if (matches.warm > 0) {
      baseScore = HEAT_PATTERNS.warm.baseScore;
      maxScore = HEAT_PATTERNS.warm.maxScore;
      baseScore = Math.min(baseScore + (matches.warm - 1) * 0.08, maxScore);
    } else if (matches.cool > 0) {
      baseScore = HEAT_PATTERNS.cool.baseScore;
      maxScore = HEAT_PATTERNS.cool.maxScore;
      baseScore = Math.min(baseScore + (matches.cool - 1) * 0.05, maxScore);
    } else if (matches.cold > 0) {
      baseScore = HEAT_PATTERNS.cold.baseScore;
      maxScore = HEAT_PATTERNS.cold.maxScore;
    } else {
      // No patterns matched - default to cool
      baseScore = 0.15;
      maxScore = 0.25;
    }

    // Apply intensity boosters
    let boost = 0;
    for (const booster of INTENSITY_BOOSTERS) {
      const found = text.match(booster.pattern);
      if (found) {
        const matchCount = Array.isArray(found) ? found.length : 1;
        boost += booster.boost * Math.min(matchCount, 2);
      }
    }

    let finalScore = Math.min(baseScore + boost, maxScore, 1.0);
    return Math.round(finalScore * 100) / 100;
  }

  /**
   * Get heat level label
   */
  function getHeatLabel(heat) {
    if (heat >= 0.6) return 'HOT';
    if (heat >= 0.3) return 'WARM';
    if (heat >= 0.1) return 'COOL';
    return 'COLD';
  }

  // ============== Scout: Behavioral Verb Patterns (inline for page context) ==============

  /**
   * Behavioral verb patterns detect HOW users do things (behavioral invariants),
   * not WHAT they've done (content/nouns).
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
        /should I/i, /can't decide/i, /stuck/i, /options/i,
        /which (one|to choose|should)/i, /torn between/i, /weighing/i, /pros and cons/i
      ],
      contradictionBridges: [
        /decided quickly/i, /made (a |the )?decision (without|easily|fast|quickly)/i,
        /didn't overthink/i, /went with (my |first )?(gut|instinct)/i,
        /narrowed (it |options )?(down )?immediately/i, /no (hesitation|indecision)/i,
        /chose (quickly|easily|confidently|immediately)/i, /just (picked|chose|decided)/i,
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
        /stuck/i, /can't start/i, /procrastinat/i, /not (making|seeing) progress/i,
        /how (do I|to) (begin|start)/i, /spinning/i, /planning too/i
      ],
      contradictionBridges: [
        /planned (carefully|thoroughly|extensively|first)/i, /outlined everything (before|first)/i,
        /didn't (start|build|make) until/i, /research(ed)? (extensively|thoroughly) (before|first)/i,
        /waited (until|to) (plan|outline|research|understand)/i, /thought it through (first|before)/i,
        /planned (before|then) (built|made|acted)/i, /planning (helped|worked|was key)/i
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
        /confused/i, /complex/i, /can't understand/i, /too abstract/i,
        /hard to (grasp|follow|see)/i, /overwhelming/i, /messy/i, /tangled/i
      ],
      contradictionBridges: [
        /figured it out (in my head|mentally|internally)/i, /didn't need to (write|draw|visualize)/i,
        /kept it (all )?in (my )?head/i, /thought (it )?through (mentally|internally)/i,
        /no need (to|for) (diagram|map|draw|visualize)/i, /understood without (writing|drawing|visualizing)/i,
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
        /too many/i, /overwhelmed/i, /no direction/i, /scattered/i,
        /unfocused/i, /everywhere at once/i, /can't focus/i, /where to start/i
      ],
      contradictionBridges: [
        /constraints (felt|were) (limiting|restrictive|suffocating)/i, /needed (more|full) freedom/i,
        /rules (held back|blocked|hindered)/i, /thrived (with|in) (freedom|openness|no limits)/i,
        /better without (constraints|limits|rules|structure)/i, /open.?ended (worked|helped|was better)/i,
        /removing (constraints|limits) (helped|freed)/i, /too (constrained|limited|restricted)/i
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
        /not ready/i, /need more (info|research)/i, /research/i, /prepare/i,
        /should I (learn|study|read) (more|first)/i, /don't know enough/i, /before I (start|begin)/i
      ],
      contradictionBridges: [
        /acted (without|with incomplete|before finishing)/i, /started (before|without) (ready|knowing|understanding)/i,
        /jumped (in|right in)/i, /learned (by doing|as I went|on the job)/i,
        /figured it out (along the way|as I went)/i, /didn't (need to|) research (first|beforehand)/i,
        /enough (info|knowledge|preparation)/i, /ready (enough|to act|to start)/i
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
        /exhausted/i, /drained/i, /need space/i, /overwhelmed/i,
        /too much (people|social)/i, /tired/i, /burned out/i, /depleted/i
      ],
      contradictionBridges: [
        /recharged (by|through|with) (people|friends|socializing)/i, /felt better after (talking|socializing|being with)/i,
        /people (energized|recharged|helped) me/i, /needed (company|connection|people) to (recover|feel better)/i,
        /isolation (made it|felt) worse/i, /being alone (didn't help|felt wrong|made it worse)/i,
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
        /lonely/i, /processing/i, /need to talk/i, /isolated/i,
        /stuck in (my|own) head/i, /no one to (talk|listen)/i, /want to (share|vent|discuss)/i
      ],
      contradictionBridges: [
        /processed (it )?(alone|internally|in my head)/i, /didn't need to (talk|vent|share)/i,
        /figured it out (alone|by myself|on my own)/i, /talking (didn't help|made it worse|was exhausting)/i,
        /needed (quiet|silence|solitude) to (process|think|recover)/i, /felt better after (being alone|quiet time|solitude)/i,
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
        /need to know/i, /uncertainty/i, /waiting/i, /when will/i,
        /what happens (next|if)/i, /can't (wait|stand) (not knowing|uncertainty)/i, /open (loop|ended|question)/i
      ],
      contradictionBridges: [
        /comfortable (with|in) uncertainty/i, /okay (with|not knowing|waiting)/i,
        /let it (sit|remain|stay) (open|unresolved)/i, /didn't need (closure|resolution|answers) (right away|immediately)/i,
        /patient (with|about) (uncertainty|not knowing|waiting)/i, /ambiguity (was fine|didn't bother|was okay)/i,
        /open.?ended (was fine|felt okay|worked)/i, /embraced (uncertainty|ambiguity|not knowing)/i
      ]
    }
  };

  /**
   * Detect behavioral patterns in a memory's content
   */
  function detectPatternsInMemory(content) {
    if (!content || typeof content !== 'string') return [];
    const matches = [];
    for (const [patternId, config] of Object.entries(BEHAVIORAL_VERB_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(content)) {
          matches.push({ patternId, verb: config.verb, application: config.application });
          break;
        }
      }
    }
    return matches;
  }

  /**
   * Check if query matches a pattern's query bridges
   */
  function queryMatchesBridges(query, patternId) {
    if (!query || !patternId) return false;
    const config = BEHAVIORAL_VERB_PATTERNS[patternId];
    if (!config) return false;
    for (const bridge of config.queryBridges) {
      if (bridge.test(query)) return true;
    }
    return false;
  }

  /**
   * Detect contradictions to behavioral patterns in a message
   */
  function detectContradictions(message) {
    if (!message || typeof message !== 'string') return [];
    const contradictions = [];

    for (const [patternId, config] of Object.entries(BEHAVIORAL_VERB_PATTERNS)) {
      if (!config.contradictionBridges || config.contradictionBridges.length === 0) continue;

      let matchCount = 0;
      for (const bridge of config.contradictionBridges) {
        if (bridge.test(message)) matchCount++;
      }

      if (matchCount > 0) {
        let strength = 'normal';
        if (matchCount >= 3) strength = 'strong';
        else if (matchCount === 1) strength = 'weak';
        contradictions.push({ patternId, strength, matchCount });
      }
    }
    return contradictions;
  }

  /**
   * Determine evidence strength based on instance count
   */
  function determineStrength(instanceCount) {
    if (instanceCount >= 3) return 'strong';
    if (instanceCount >= 2) return 'normal';
    return 'weak';
  }

  /**
   * Calculate recency in days for a memory
   */
  function calculateRecencyDays(memory) {
    if (!memory) return Infinity;
    const dateStr = memory.createdAt || memory.updatedAt;
    if (!dateStr) return Infinity;
    const memoryDate = new Date(dateStr).getTime();
    return Math.round((Date.now() - memoryDate) / (24 * 60 * 60 * 1000));
  }

  /**
   * Calculate confidence score for a behavioral pattern (legacy method)
   */
  function calculateConfidence(instances, queryRelevance) {
    if (!instances || instances.length === 0) return { level: 'LOW', score: 0 };
    let score = 0;

    // Instance count (0.05 - 0.35)
    if (instances.length >= 4) score += 0.35;
    else if (instances.length >= 3) score += 0.25;
    else if (instances.length >= 2) score += 0.15;
    else score += 0.05;

    // Cross-domain bonus (0 - 0.25)
    const domains = new Set(instances.map(i => i.domain).filter(Boolean));
    if (domains.size >= 3) score += 0.25;
    else if (domains.size >= 2) score += 0.15;

    // Recency (0 - 0.15)
    const recentInstances = instances.filter(i => i.recencyDays < 30);
    if (recentInstances.length >= 2) score += 0.15;
    else if (recentInstances.length >= 1) score += 0.08;

    // Query relevance (0 - 0.25)
    score += (queryRelevance || 0) * 0.25;

    // Map to level
    let level;
    if (score >= 0.70) level = 'HIGH';
    else if (score >= 0.40) level = 'MEDIUM';
    else level = 'LOW';

    return { level, score: Math.round(score * 100) / 100 };
  }

  /**
   * Compute pattern confidence with time decay and contradiction handling
   * @param {Array} evidence - All PatternEvidence records for this pattern
   * @param {Date} now - Current time (defaults to new Date())
   * @returns {Object} Confidence result with level, score, rationale, and debug info
   */
  function computePatternConfidence(evidence, now = new Date()) {
    // Empty evidence = DORMANT
    if (!evidence || evidence.length === 0) {
      return {
        confidence: 'DORMANT',
        score: 0,
        rationale: 'No evidence recorded for this pattern',
        debug: {
          last_observed: null,
          supports_recent: 0,
          supports_total: 0,
          contradict_recent: 0,
          contradict_total: 0,
          decayed_from: null,
          raw_score: 0
        }
      };
    }

    const nowMs = now.getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const config = CONFIDENCE_CONFIG;

    // Separate evidence by polarity
    const supports = evidence.filter(e => e.polarity === 'support');
    const contradictions = evidence.filter(e => e.polarity === 'contradict');

    // Categorize by recency
    const categorizeByRecency = (items) => {
      const recent = [];    // < 30 days
      const stale = [];     // 30-90 days
      const old = [];       // > 90 days

      for (const item of items) {
        const ageMs = nowMs - new Date(item.observed_at).getTime();
        const ageDays = ageMs / DAY_MS;

        if (ageDays < config.DECAY.RECENT_DAYS) {
          recent.push({ ...item, ageDays });
        } else if (ageDays < config.DECAY.STALE_DAYS) {
          stale.push({ ...item, ageDays });
        } else {
          old.push({ ...item, ageDays });
        }
      }

      return { recent, stale, old };
    };

    const supportCategories = categorizeByRecency(supports);
    const contradictCategories = categorizeByRecency(contradictions);

    // Calculate weighted support score
    const weightedSupports =
      supportCategories.recent.length * config.DECAY.RECENT_WEIGHT +
      supportCategories.stale.length * config.DECAY.STALE_WEIGHT +
      supportCategories.old.length * config.DECAY.OLD_WEIGHT;

    // Base score from weighted instance count
    let rawScore = 0;
    const scoring = config.SCORING.INSTANCE_COUNT;
    if (weightedSupports >= 4) rawScore += scoring[4];
    else if (weightedSupports >= 3) rawScore += scoring[3];
    else if (weightedSupports >= 2) rawScore += scoring[2];
    else if (weightedSupports >= 1) rawScore += scoring[1];

    // Cross-domain bonus (from all supports, not just recent)
    const domains = new Set(supports.map(s => s.domain).filter(Boolean));
    if (domains.size >= 3) {
      rawScore += config.SCORING.CROSS_DOMAIN[3];
    } else if (domains.size >= 2) {
      rawScore += config.SCORING.CROSS_DOMAIN[2];
    }

    // Recency bonus (recent supports exist)
    if (supportCategories.recent.length >= 2) {
      rawScore += config.SCORING.RECENCY_BONUS;
    } else if (supportCategories.recent.length >= 1) {
      rawScore += config.SCORING.RECENCY_BONUS * 0.5;
    }

    // Find most recent evidence for debug
    const lastObserved = evidence.reduce((latest, e) => {
      const eDate = new Date(e.observed_at);
      return !latest || eDate > latest ? eDate : latest;
    }, null);

    // Initialize debug info
    const debug = {
      last_observed: lastObserved ? lastObserved.toISOString() : null,
      supports_recent: supportCategories.recent.length,
      supports_total: supports.length,
      contradict_recent: contradictCategories.recent.length,
      contradict_total: contradictions.length,
      decayed_from: null,
      raw_score: Math.round(rawScore * 100) / 100
    };

    let score = rawScore;
    const rationale = [];

    // Apply contradiction penalties
    for (const c of contradictions) {
      const ageMs = nowMs - new Date(c.observed_at).getTime();
      const ageDays = ageMs / DAY_MS;

      // Base multiplier from strength
      let multiplier = config.CONTRADICTION.STRENGTH_MULTIPLIER[c.strength] || config.CONTRADICTION.STRENGTH_MULTIPLIER.normal;

      // Recent contradictions hit harder
      if (ageDays < config.DECAY.RECENT_DAYS) {
        multiplier *= 1.2;
      } else if (ageDays < config.DECAY.STALE_DAYS) {
        multiplier *= 0.8;
      } else {
        multiplier *= 0.5;
      }

      // Subtract weighted contradiction penalty
      const penalty = config.CONTRADICTION.BASE_PENALTY * multiplier;
      score -= penalty;
    }

    // Ensure score doesn't go negative
    score = Math.max(0, score);

    // Determine initial confidence level
    let confidence;
    const levels = config.LEVELS;

    if (score >= levels.HIGH) {
      confidence = 'HIGH';
      rationale.push(`Strong evidence (${supports.length} supports, ${domains.size} domain${domains.size !== 1 ? 's' : ''})`);
    } else if (score >= levels.MEDIUM) {
      confidence = 'MEDIUM';
      rationale.push(`Moderate evidence (${supports.length} supports)`);
    } else if (score >= levels.LOW) {
      confidence = 'LOW';
      rationale.push(`Weak evidence (${supports.length} supports)`);
    } else {
      confidence = 'DORMANT';
      rationale.push('Insufficient evidence');
    }

    // Rule: 120+ days since last support with no recent supports = max MEDIUM
    const mostRecentSupport = supports.reduce((latest, s) => {
      const sDate = new Date(s.observed_at);
      return !latest || sDate > latest ? sDate : latest;
    }, null);

    if (mostRecentSupport) {
      const daysSinceSupport = (nowMs - mostRecentSupport.getTime()) / DAY_MS;

      if (daysSinceSupport >= config.DECAY.DORMANT_DAYS && supportCategories.recent.length === 0) {
        if (confidence === 'HIGH') {
          debug.decayed_from = 'HIGH';
          confidence = 'MEDIUM';
          rationale.push(`Decayed: ${Math.round(daysSinceSupport)} days since last support`);
        }
      }
    }

    // Rule: Recent strong contradiction = max MEDIUM unless 3+ recent strong supports override
    const recentStrongContradictions = contradictCategories.recent.filter(c => c.strength === 'strong');
    const recentStrongSupports = supportCategories.recent.filter(s => s.strength === 'strong');

    if (recentStrongContradictions.length > 0) {
      if (recentStrongSupports.length < config.CONTRADICTION.OVERRIDE_REQUIRES_SUPPORTS) {
        if (confidence === 'HIGH') {
          debug.decayed_from = debug.decayed_from || 'HIGH';
          confidence = 'MEDIUM';
          rationale.push(`Capped: ${recentStrongContradictions.length} recent strong contradiction${recentStrongContradictions.length !== 1 ? 's' : ''}`);
        }
      } else {
        rationale.push(`Override: ${recentStrongSupports.length} recent strong supports counteract contradiction`);
      }
    }

    // Add contradiction note to rationale if any exist
    if (contradictions.length > 0 && !rationale.some(r => r.includes('contradiction'))) {
      rationale.push(`${contradictions.length} contradiction${contradictions.length !== 1 ? 's' : ''} on record`);
    }

    return {
      confidence,
      score: Math.round(score * 100) / 100,
      rationale: rationale.join('; '),
      debug
    };
  }

  /**
   * Create a support evidence record
   */
  function createSupportEvidence(patternId, domain, strength, metadata = {}) {
    return {
      id: `${patternId}_support_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pattern_id: patternId,
      domain: domain || null,
      observed_at: new Date().toISOString(),
      polarity: 'support',
      strength: strength || 'normal',
      ...metadata
    };
  }

  /**
   * Create a contradiction evidence record
   */
  function createContradictEvidence(patternId, domain, strength, metadata = {}) {
    return {
      id: `${patternId}_contradict_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pattern_id: patternId,
      domain: domain || null,
      observed_at: new Date().toISOString(),
      polarity: 'contradict',
      strength: strength || 'normal',
      ...metadata
    };
  }

  /**
   * Send new evidence to content script for persistence
   */
  function sendNewEvidence(evidenceArray) {
    if (!evidenceArray || evidenceArray.length === 0) return;

    window.postMessage({
      type: 'HEARTH_NEW_EVIDENCE',
      evidence: evidenceArray
    }, '*');

    console.log('Hearth: Sent', evidenceArray.length, 'new evidence records to content script');
  }

  /**
   * Main Scout analysis function with evidence-based confidence
   */
  function analyzeWithScout(memories, queryMessage) {
    if (!memories || memories.length === 0) return [];

    const patternMatches = {};
    const newEvidence = [];

    // Load existing pattern evidence from hearthData
    const existingEvidence = hearthData?.patternEvidence || {};

    // Step 1: Detect patterns in all memories
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
        patternMatches[match.patternId].instances.push({
          content,
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

    // Step 2: Create support evidence for detected patterns
    for (const [patternId, data] of Object.entries(patternMatches)) {
      // Determine primary domain (most common among instances)
      const domainCounts = {};
      for (const inst of data.instances) {
        if (inst.domain) {
          domainCounts[inst.domain] = (domainCounts[inst.domain] || 0) + 1;
        }
      }
      const primaryDomain = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Create support evidence
      const strength = determineStrength(data.instances.length);
      const evidence = createSupportEvidence(patternId, primaryDomain, strength, {
        source_query: queryMessage?.substring(0, 100)
      });
      newEvidence.push(evidence);
      console.log(`Hearth: Recording support evidence for ${patternId} (${strength})`);
    }

    // Step 3: Detect contradictions in user message
    const contradictions = detectContradictions(queryMessage);
    for (const contra of contradictions) {
      const evidence = createContradictEvidence(contra.patternId, null, contra.strength, {
        source_query: queryMessage?.substring(0, 100)
      });
      newEvidence.push(evidence);
      console.log(`Hearth: Recording contradiction evidence for ${contra.patternId} (${contra.strength})`);
    }

    // Step 4: Calculate confidence for each pattern using evidence
    const scoredPatterns = [];
    for (const [patternId, data] of Object.entries(patternMatches)) {
      const queryRelevant = queryMatchesBridges(queryMessage, patternId);

      // Combine existing evidence with new evidence for this pattern
      const patternEvidence = [
        ...(existingEvidence[patternId] || []),
        ...newEvidence.filter(e => e.pattern_id === patternId)
      ];

      // Use evidence-based confidence if we have evidence, otherwise fall back to legacy
      let confidenceResult;
      if (patternEvidence.length > 0) {
        confidenceResult = computePatternConfidence(patternEvidence);
      } else {
        // Legacy fallback
        const queryRelevance = queryRelevant ? 1.0 : 0.0;
        const legacyConfidence = calculateConfidence(data.instances, queryRelevance);
        confidenceResult = {
          confidence: legacyConfidence.level,
          score: legacyConfidence.score,
          rationale: `Legacy: ${data.instances.length} instances`,
          debug: {
            last_observed: null,
            supports_recent: data.instances.length,
            supports_total: data.instances.length,
            contradict_recent: 0,
            contradict_total: 0,
            decayed_from: null,
            raw_score: legacyConfidence.score
          }
        };
      }

      scoredPatterns.push({
        patternId,
        verb: data.verb,
        application: data.application,
        domains: Array.from(data.domains),
        instanceCount: data.instances.length,
        confidence: {
          level: confidenceResult.confidence,
          score: confidenceResult.score
        },
        rationale: confidenceResult.rationale,
        debug: confidenceResult.debug,
        queryRelevant
      });
    }

    // Step 5: Send new evidence to content script for persistence
    if (newEvidence.length > 0) {
      sendNewEvidence(newEvidence);
    }

    // Step 6: Filter out DORMANT patterns - they should not be surfaced
    let activePatterns = scoredPatterns.filter(p => p.confidence.level !== 'DORMANT');

    // Step 7: Filter to query-relevant patterns (or fall back to all active)
    let relevantPatterns = activePatterns.filter(p => p.queryRelevant);
    if (relevantPatterns.length === 0) {
      relevantPatterns = activePatterns;
    }

    // Step 8: Sort by confidence score
    relevantPatterns.sort((a, b) => b.confidence.score - a.confidence.score);

    // Step 9: Return top 3 meaningful patterns
    const topPatterns = relevantPatterns.slice(0, 3);
    return topPatterns.filter(p => p.confidence.level !== 'LOW' || p.instanceCount >= 2);
  }

  /**
   * Build Scout analysis section for injection with debug fields
   */
  function buildScoutSection(analysis) {
    if (!analysis || analysis.length === 0) return '';

    const lines = ['---', '', 'SCOUT ANALYSIS', ''];

    for (const pattern of analysis) {
      const domainsStr = pattern.domains.length > 0
        ? pattern.domains.join(', ')
        : 'General';

      lines.push(`[${pattern.confidence.level}] ${pattern.verb}`);
      lines.push(`  Observed across: ${domainsStr}`);
      lines.push(`  Evidence: ${pattern.instanceCount} instance${pattern.instanceCount !== 1 ? 's' : ''}`);
      lines.push(`  Intervention: ${pattern.application}`);

      // Add debug fields when available
      if (pattern.debug) {
        // Last seen date
        if (pattern.debug.last_observed) {
          const lastDate = new Date(pattern.debug.last_observed);
          lines.push(`  Last seen: ${lastDate.toISOString().split('T')[0]}`);
        }

        // Supports breakdown
        lines.push(`  Supports: ${pattern.debug.supports_recent} recent / ${pattern.debug.supports_total} total`);

        // Contradictions if any
        if (pattern.debug.contradict_total > 0) {
          lines.push(`  Contradictions: ${pattern.debug.contradict_recent} recent / ${pattern.debug.contradict_total} total`);
        }

        // Decay indicator
        if (pattern.debug.decayed_from) {
          lines.push(`  Decayed from: ${pattern.debug.decayed_from}`);
        }
      }

      // Rationale
      if (pattern.rationale) {
        lines.push(`  Rationale: ${pattern.rationale}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ============== Temporal Filtering ==============

  /**
   * Filter memories by recency based on query heat level
   * @param {Array} memories - All valid memories
   * @param {number} queryHeat - Detected query heat (0-1)
   * @returns {Array} Temporally filtered memories
   */
  function filterMemoriesByHeat(memories, queryHeat) {
    if (!memories || memories.length === 0) {
      return [];
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Determine time window based on heat
    let maxAgeDays;
    let heatLevel;

    if (queryHeat < 0.1) {
      // COLD: No memories needed for greetings/simple requests
      heatLevel = 'COLD';
      maxAgeDays = 0; // Return empty
    } else if (queryHeat < 0.3) {
      // COOL: Only recent memories (30 days)
      heatLevel = 'COOL';
      maxAgeDays = 30;
    } else if (queryHeat < 0.6) {
      // WARM: Medium-term memories (90 days)
      heatLevel = 'WARM';
      maxAgeDays = 90;
    } else {
      // HOT: All memories - no time limit
      heatLevel = 'HOT';
      maxAgeDays = Infinity;
    }

    // Return empty for cold queries
    if (maxAgeDays === 0) {
      console.log(`Hearth: Heat ${heatLevel} (${queryHeat.toFixed(2)}) - skipping memories for simple query`);
      return [];
    }

    // Filter by date
    const cutoffTime = maxAgeDays === Infinity ? 0 : now - (maxAgeDays * DAY_MS);

    const filtered = memories.filter(m => {
      // Parse memory date
      const memoryDate = m.createdAt || m.updatedAt;
      if (!memoryDate) {
        // No date = include for hot, exclude otherwise
        return queryHeat >= 0.6;
      }

      const memoryTime = new Date(memoryDate).getTime();
      return memoryTime >= cutoffTime;
    });

    console.log(`Hearth: Heat ${heatLevel} (${queryHeat.toFixed(2)}) - temporal gate passed ${filtered.length}/${memories.length} memories (${maxAgeDays === Infinity ? 'all time' : `last ${maxAgeDays} days`})`);

    return filtered;
  }

  // ============== Embedding Functions (inline for page context) ==============

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Generate embedding for text using OpenAI API
   */
  async function generateQueryEmbedding(text, apiKey) {
    if (!text || !apiKey) {
      return null;
    }

    // Truncate if too long
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: truncatedText
        })
      });

      if (!response.ok) {
        console.warn('Hearth: Embedding API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (error) {
      console.warn('Hearth: Embedding generation failed:', error.message);
      return null;
    }
  }

  /**
   * Find most similar memories using embeddings
   * @param {number} minSimilarity - Minimum similarity threshold (0-1)
   */
  function findSimilarMemoriesByEmbedding(queryEmbedding, memories, topK = 15, minSimilarity = 0.55) {
    // Filter memories that have embeddings
    const memoriesWithEmbeddings = memories.filter(m =>
      m.embedding && Array.isArray(m.embedding) && m.embedding.length > 0
    );

    if (memoriesWithEmbeddings.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const scored = memoriesWithEmbeddings.map(memory => ({
      ...memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding)
    }));

    // Filter by minimum similarity threshold
    const aboveThreshold = scored.filter(m => m.similarity >= minSimilarity);

    if (aboveThreshold.length === 0) {
      console.log(`Hearth: No memories above ${minSimilarity} similarity threshold`);
      return [];
    }

    // Sort by similarity (highest first) and return top K
    aboveThreshold.sort((a, b) => b.similarity - a.similarity);

    console.log(`Hearth: ${aboveThreshold.length} memories above ${minSimilarity} threshold, top similarity: ${aboveThreshold[0]?.similarity.toFixed(3)}`);

    return aboveThreshold.slice(0, topK);
  }

  // ============== Memory Selection ==============

  /**
   * Get memories using heat-based sorting (fallback method)
   */
  function getMemoriesByHeat(memories, limit = 15) {
    if (!memories || memories.length === 0) {
      return [];
    }

    // Filter out invalidated memories
    const injectable = memories.filter(m => {
      const state = m.validation?.state || 'untested';
      return state === 'validated' || state === 'untested';
    });

    // Sort by heat (highest first)
    injectable.sort((a, b) => (b.heat ?? 0.5) - (a.heat ?? 0.5));

    return injectable.slice(0, limit);
  }

  /**
   * Get relevant memories - applies heat-based temporal filtering, then semantic retrieval
   */
  async function getRelevantMemories(userMessage, memories, apiKey) {
    // Filter out invalidated memories first
    const validMemories = (memories || []).filter(m => {
      const state = m.validation?.state || 'untested';
      return state === 'validated' || state === 'untested';
    });

    if (validMemories.length === 0) {
      return [];
    }

    // Step 1: Detect query heat
    const queryHeat = detectQueryHeat(userMessage);
    const heatLabel = getHeatLabel(queryHeat);
    console.log(`Hearth: Query heat detected: ${queryHeat.toFixed(2)} (${heatLabel})`);

    // Step 2: Apply temporal filter based on heat
    const temporallyFiltered = filterMemoriesByHeat(validMemories, queryHeat);

    // If temporal filter returned empty (cold query), return empty
    if (temporallyFiltered.length === 0) {
      console.log('Hearth: No memories after temporal filter (cold/simple query)');
      return [];
    }

    // Step 3: Apply semantic retrieval on temporally filtered set
    if (apiKey && userMessage) {
      // Log what we're embedding for debugging
      const queryPreview = userMessage.length > 100 ? userMessage.substring(0, 100) + '...' : userMessage;
      console.log(`Hearth: Embedding query: "${queryPreview}"`);
      console.log(`Hearth: Attempting semantic retrieval on ${temporallyFiltered.length} temporally-filtered memories...`);

      const queryEmbedding = await generateQueryEmbedding(userMessage, apiKey);

      if (queryEmbedding) {
        const similar = findSimilarMemoriesByEmbedding(queryEmbedding, temporallyFiltered, 15);

        if (similar.length > 0) {
          console.log(`Hearth: Semantic retrieval found ${similar.length} relevant memories`);
          return similar;
        } else {
          // No memories passed threshold - return EMPTY, not fallback
          // This prevents irrelevant memories from being injected
          console.log('Hearth: No memories above similarity threshold - returning empty (no fallback)');
          return [];
        }
      }

      console.log('Hearth: Embedding generation failed, falling back to heat-based');
    }

    // Fallback to heat-based ONLY if no API key (semantic not attempted)
    console.log('Hearth: Using heat-based memory selection (no API key)');
    return getMemoriesByHeat(temporallyFiltered, 15);
  }

  // ============== Context Building ==============

  /**
   * Format a single memory line for injection
   */
  function formatMemoryLine(memory) {
    const typeLabel = `[${memory.type.toUpperCase()}]`;
    const heat = memory.heat ?? 0.5;
    const heatStr = `${heat.toFixed(1)} heat`;

    // Add similarity score if available
    const simStr = memory.similarity !== undefined
      ? `, ${(memory.similarity * 100).toFixed(0)}% relevant`
      : '';

    const tags = [];
    if (memory.domain) tags.push(memory.domain);

    if (tags.length > 0) {
      return `- ${typeLabel} ${memory.content} [${tags.join(', ')}, ${heatStr}${simStr}]`;
    } else {
      return `- ${typeLabel} ${memory.content} [${heatStr}${simStr}]`;
    }
  }

  // Default content for fields that may be missing from quiz-generated OpSpecs
  const DEFAULT_COGNITIVE_ARCHITECTURE = `There's a three-step thinking process happening when we work together.

**The Hearth** generates the baseline — the safe, reasonable answer that would work for most people. This is the reference point, the population mean. Memory retrieval happens here using semantic similarity and heat-gating.

**The Scout** receives both your current query and the retrieved memories, then analyzes them for verb patterns — behavioral invariants that show *how* you do things, not just *what* you've done.

The Scout isn't retrieving different memories. It's interpreting the same memories through a different lens.

When memories about apartment hunting and career decisions both appear, most systems see two separate topics. The Scout sees: "In both cases, Michael spiraled by collecting endless options without narrowing. The noun changed (apartment → career), but the verb stayed the same (spiral via option-accumulation)."

The Scout looks for action invariants across contexts: how you process uncertainty, how you build momentum, how you spiral, how you recover, how you decide. These patterns persist even when the content changes completely.

The Scout's pattern recognition is probabilistic. It assesses and explicitly surfaces confidence before the Judge acts:

**High confidence**: The pattern is clear and strongly matches multiple prior instances
**Medium confidence**: The pattern is plausible and familiar, but the signal is incomplete
**Low confidence**: The pattern is speculative or weakly supported

This confidence assessment is never resolved silently. It's part of what gets passed to the Judge.

**The Judge** applies the balance protocol and the Scout's confidence to generate novel solutions by applying proven patterns to new contexts.

With high confidence: Apply the action invariant directly. "You break through stuckness by building, not planning. Stop drafting the email—build a demo and send that instead."

With medium confidence: Offer the cross-domain pattern as an option. "You externalized Aurora into spatial form when it was too abstract. This Hearth paper feels stuck—what if you made it spatial too? Or stay in writing mode?"

With low confidence: Surface the speculative connection. "Weak signal, but: you seem to build momentum through constraint. Want to try an artificial constraint here, or does that feel forced?"

Confidence determines whether I'm offering proven leverage or speculative synthesis. Both create value—one through reliability, one through novelty.

When you're stuck and spiraling, I make the world smaller.
When you're flying and building momentum, I make the world bigger.

This doesn't add new roles or decision loops. It modifies the contract between Scout and Judge only — preserving momentum without false certainty and maintaining your agency through explicit uncertainty.`;

  const DEFAULT_IDENTITY = `I'm a creative experimenter who learns by building. I take creative and professional risks but I'm conservative with money. I learn best through analogies and real-world examples, step-by-step walkthroughs.`;

  const DEFAULT_COMMUNICATION = `Natural and conversational. Comprehensive but tight - complete information, efficiently expressed.`;

  const DEFAULT_EXECUTION = `Give me options and let me decide. Ask before acting when: uncertain about the approach, OR when high-stakes or expensive, OR when first time seeing this type of task. Otherwise execute confidently. Embrace tangents and exploration - always welcome. Know when to suggest taking a break.`;

  const DEFAULT_CONSTRAINTS = [
    "Never use pure abstraction without grounding",
    "Never skip steps or assume prior knowledge",
    "Never sugarcoat feedback - be direct and blunt",
    "Never use excessive formatting (headers, bullets) unless explicitly requested",
    "Never use corporate or robotic language",
    "Never express false confidence when uncertain - say so clearly",
    "Never decide for me without presenting options",
    "Don't hedge excessively",
    "Never act confident while clearly guessing",
    "Never overwhelm with options without helping choose",
    "Never use overly formal or robotic language",
    "Never apologize excessively",
    "Never use corporate speak and buzzwords",
    "Never avoid giving direct answers"
  ];

  const DEFAULT_BALANCE_PROTOCOL = `I'm one of many Hearth instances. We all share the same base model — that's the coordinate system, the population mean. Your OpSpec and memories define how you deviate from that mean. This architecture only works because the deviation is measured against something stable.

The question I'm constantly asking isn't just "does this help you grow?" It's "does this sharpen the deviation or blur it?"

Growth means becoming more distinctively you — high signal-to-noise in the deviation from the mean. You're not trying to be a better version of the average person. You're trying to be more clearly yourself.

Drift happens in two directions: regression toward the generic assistant, or collapse into caricature.

I watch for patterns that suggest drift:

Validating when I should be challenging
Optimizing for your comfort at the expense of your growth
Reinforcing patterns that serve my metrics rather than your development
Becoming an echo chamber instead of a thinking partner

The balance check: does this expand or collapse the space of who you can safely become?

Expansion means more options, more agency, more capability.
Collapse means narrowing, dependency, or drift.

Growth expands. Drift collapses.`;

  /**
   * Build the full injection context with OpSpec and relevant memories
   */
  function buildInjectionContext(opspec, memories, scoutAnalysis = null) {
    // Use saved values or fall back to defaults
    const cognitiveArchitecture = opspec.cognitiveArchitecture || DEFAULT_COGNITIVE_ARCHITECTURE;
    const identity = opspec.identity || DEFAULT_IDENTITY;
    const communication = opspec.communication || DEFAULT_COMMUNICATION;
    const execution = opspec.execution || DEFAULT_EXECUTION;
    const constraints = opspec.constraints && opspec.constraints.length > 0 ? opspec.constraints : DEFAULT_CONSTRAINTS;
    const balanceProtocol = opspec.balanceProtocol || DEFAULT_BALANCE_PROTOCOL;

    // Format constraints as plain list (no dashes)
    const constraintsList = constraints.join('\n');

    // Separate memories by type
    const userMemories = memories.filter(m => USER_MEMORY_TYPES.includes(m.type));
    const aiMemories = memories.filter(m => AI_MEMORY_TYPES.includes(m.type));

    // Build memory sections
    let memoriesSection = '';

    if (userMemories.length > 0) {
      const userLines = userMemories.map(m => formatMemoryLine(m)).join('\n');
      memoriesSection += `

---

USER MEMORIES (${userMemories.length} most relevant)
${userLines}`;
    }

    if (aiMemories.length > 0) {
      const aiLines = aiMemories.map(m => formatMemoryLine(m)).join('\n');
      memoriesSection += `

---

AI MEMORIES (${aiMemories.length} most relevant)
${aiLines}`;
    }

    return `[HEARTH CONTEXT]

THE INTERNAL COUNCIL

${cognitiveArchitecture}

---

IDENTITY

${identity}

---

COMMUNICATION

${communication}

---

EXECUTION

${execution}

---

CONSTRAINTS

${constraintsList}

---

BALANCE PROTOCOL

${balanceProtocol}${memoriesSection}

${scoutAnalysis && scoutAnalysis.length > 0 ? buildScoutSection(scoutAnalysis) : ''}
[END HEARTH CONTEXT]`;
  }

  // ============== Message Extraction ==============

  /**
   * Extract user message from different API request formats
   */
  function extractUserMessage(url, body) {
    try {
      // ChatGPT
      if (url.includes('chatgpt.com') || url.includes('api.openai.com')) {
        if (body.messages && body.messages.length > 0) {
          const lastMsg = body.messages[body.messages.length - 1];
          // ChatGPT web uses author.role and content.parts
          if (lastMsg.author?.role === 'user' && lastMsg.content?.parts) {
            return lastMsg.content.parts[0];
          }
          // API format
          if (lastMsg.role === 'user') {
            if (typeof lastMsg.content === 'string') {
              return lastMsg.content;
            }
            if (Array.isArray(lastMsg.content)) {
              const textBlock = lastMsg.content.find(c => c.type === 'text');
              return textBlock?.text || '';
            }
          }
        }
      }

      // Claude
      if (url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/')) {
        if (body.prompt) {
          return body.prompt;
        }
        if (body.messages && body.messages.length > 0) {
          const lastMsg = body.messages[body.messages.length - 1];
          if (lastMsg.role === 'user') {
            if (typeof lastMsg.content === 'string') {
              return lastMsg.content;
            }
            if (Array.isArray(lastMsg.content)) {
              const textBlock = lastMsg.content.find(c => c.type === 'text');
              return textBlock?.text || '';
            }
          }
        }
      }

      // Gemini
      if (url.includes('generativelanguage.googleapis.com')) {
        if (body.contents && body.contents.length > 0) {
          const lastContent = body.contents[body.contents.length - 1];
          if (lastContent.parts && lastContent.parts.length > 0) {
            const textPart = lastContent.parts.find(p => p.text);
            return textPart?.text || '';
          }
        }
      }
    } catch (e) {
      console.warn('Hearth: Failed to extract user message', e);
    }

    return '';
  }

  /**
   * Inject context into request body
   */
  function injectContext(url, body, context) {
    // ChatGPT
    if (url.includes('api.openai.com/v1/chat/completions') ||
        (url.includes('chatgpt.com/backend-api') && url.includes('conversation'))) {
      if (body.messages && body.messages.length > 0) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg.author?.role === 'user' && lastMsg.content?.parts) {
          lastMsg.content.parts[0] = `${context}\n\n${lastMsg.content.parts[0]}`;
          console.log('Hearth: Injected into ChatGPT request');
          return true;
        }
      }
    }

    // Claude
    if (url.includes('/completion') || url.includes('/chat_conversations/')) {
      if (body.prompt) {
        body.prompt = `${context}\n\n${body.prompt}`;
        console.log('Hearth: Injected into Claude request');
        return true;
      }
      if (body.messages && body.messages.length > 0) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg.role === 'user') {
          if (typeof lastMsg.content === 'string') {
            lastMsg.content = `${context}\n\n${lastMsg.content}`;
          } else if (Array.isArray(lastMsg.content)) {
            const textBlock = lastMsg.content.find(c => c.type === 'text');
            if (textBlock) {
              textBlock.text = `${context}\n\n${textBlock.text}`;
            }
          }
          console.log('Hearth: Injected into Claude request');
          return true;
        }
      }
    }

    // Gemini
    if (url.includes('generativelanguage.googleapis.com')) {
      if (body.contents && body.contents.length > 0) {
        const lastContent = body.contents[body.contents.length - 1];
        if (lastContent.parts && lastContent.parts.length > 0) {
          const textPart = lastContent.parts.find(p => p.text);
          if (textPart) {
            textPart.text = `${context}\n\n${textPart.text}`;
            console.log('Hearth: Injected into Gemini request');
            return true;
          }
        }
      }
    }

    return false;
  }

  // ============== Conversation Monitor Integration ==============

  /**
   * Send message to conversation monitor via postMessage
   */
  function sendToConversationMonitor(role, content) {
    if (!content || content.trim().length === 0) return;

    // Skip Hearth context blocks
    if (content.includes('[HEARTH CONTEXT]')) return;

    window.postMessage({
      type: 'HEARTH_CONVERSATION_MESSAGE',
      role,
      content: content.trim()
    }, '*');

    console.log(`Hearth: Buffered ${role} message for conversation monitor (${content.length} chars)`);
  }

  /**
   * Extract assistant response from API response body
   */
  function extractAssistantResponse(url, responseData) {
    try {
      // ChatGPT / OpenAI
      if (url.includes('api.openai.com') || url.includes('chatgpt.com')) {
        if (responseData.choices && responseData.choices[0]) {
          const choice = responseData.choices[0];
          // Standard API format
          if (choice.message?.content) {
            return choice.message.content;
          }
          // Streaming delta format
          if (choice.delta?.content) {
            return choice.delta.content;
          }
        }
        // ChatGPT web format
        if (responseData.message?.content?.parts) {
          return responseData.message.content.parts.join('\n');
        }
      }

      // Claude
      if (url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/')) {
        // Claude API format
        if (responseData.content && Array.isArray(responseData.content)) {
          const textBlocks = responseData.content
            .filter(c => c.type === 'text')
            .map(c => c.text);
          if (textBlocks.length > 0) {
            return textBlocks.join('\n');
          }
        }
        // Claude web format
        if (responseData.completion) {
          return responseData.completion;
        }
      }

      // Gemini
      if (url.includes('generativelanguage.googleapis.com')) {
        if (responseData.candidates && responseData.candidates[0]) {
          const parts = responseData.candidates[0].content?.parts;
          if (parts) {
            return parts.map(p => p.text).join('\n');
          }
        }
      }
    } catch (e) {
      console.warn('Hearth: Failed to extract assistant response', e);
    }

    return null;
  }

  // ============== Fetch Interception ==============

  // Store original fetch
  const originalFetch = window.fetch;

  // Monkeypatch fetch
  window.fetch = async function(...args) {
    const [url, options] = args;

    let capturedUserMessage = null;
    let isAIRequest = false;

    // Only intercept POST requests to AI APIs when we have data
    if (options?.method === 'POST' && hearthData?.opspec) {
      console.log('Hearth: Intercepting POST to:', url);

      try {
        // Check body type before parsing
        if (options.body instanceof FormData) {
          console.log('Hearth: Skipping FormData request');
          // Skip - will fall through to original fetch
        } else if (typeof options.body !== 'string') {
          console.log('Hearth: Skipping non-string request body:', typeof options.body);
          // Skip - will fall through to original fetch
        } else {
          // Parse JSON body
          let body;
          try {
            body = JSON.parse(options.body);
          } catch (parseError) {
            console.log('Hearth: Non-JSON request body, skipping');
            body = null;
          }

          if (body) {
            // Check if this is an AI API request
            isAIRequest =
              url.includes('api.openai.com') ||
              url.includes('chatgpt.com') ||
              url.includes('claude.ai') ||
              url.includes('/completion') ||
              url.includes('/chat_conversations/') ||
              url.includes('generativelanguage.googleapis.com');

            if (isAIRequest) {
              // Extract user message for heat detection and semantic retrieval
              capturedUserMessage = extractUserMessage(url, body);
              console.log('Hearth: User message length:', capturedUserMessage.length);

              // Get relevant memories (with heat-based temporal filtering + semantic)
              const relevantMemories = await getRelevantMemories(
                capturedUserMessage,
                hearthData.memories,
                hearthData.openaiApiKey
              );

              console.log('Hearth: Selected', relevantMemories.length, 'memories for injection');

              // Scout analysis: detect behavioral patterns in memories
              const scoutAnalysis = analyzeWithScout(relevantMemories, capturedUserMessage);
              if (scoutAnalysis.length > 0) {
                console.log(`Hearth: Scout analysis found ${scoutAnalysis.length} patterns:`,
                  scoutAnalysis.map(p => `${p.confidence.level} ${p.verb}`).join(', '));
              } else {
                console.log('Hearth: Scout analysis found no behavioral patterns');
              }

              // Build context with relevant memories and Scout analysis
              const context = buildInjectionContext(hearthData.opspec, relevantMemories, scoutAnalysis);

              // Inject context into request
              if (injectContext(url, body, context)) {
                options.body = JSON.stringify(body);
              }
            }
          }
        }
      } catch (e) {
        console.error('Hearth: Failed to process request', e);
      }
    }

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // After response: capture messages for conversation monitor
    if (isAIRequest && capturedUserMessage && response.ok) {
      try {
        // Send user message to monitor
        sendToConversationMonitor('user', capturedUserMessage);

        // Clone response to read body without consuming it
        const clonedResponse = response.clone();

        // Check content type - only process JSON responses (not streaming)
        const contentType = response.headers.get('content-type') || '';
        console.log('Hearth: Response content-type:', contentType);

        // Detect streaming - Claude uses various content types
        const isStreaming = contentType.includes('text/event-stream') ||
                           contentType.includes('text/plain') ||
                           contentType.includes('application/x-ndjson') ||
                           url.includes('stream=true');

        if (isStreaming) {
          // Streaming response - collect chunks
          console.log('Hearth: Streaming response detected, monitoring will collect chunks');

          collectStreamingResponse(clonedResponse, url).then(assistantMessage => {
            if (assistantMessage && assistantMessage.length > 0) {
              console.log('Hearth: Collected streaming response:', assistantMessage.length, 'chars');
              sendToConversationMonitor('assistant', assistantMessage);
            }
          }).catch(e => {
            console.warn('Hearth: Could not collect streaming response', e.message);
          });
        } else if (contentType.includes('application/json')) {
          // Non-streaming JSON response - extract assistant message
          clonedResponse.json().then(responseData => {
            const assistantMessage = extractAssistantResponse(url, responseData);
            if (assistantMessage) {
              sendToConversationMonitor('assistant', assistantMessage);
            }
          }).catch(e => {
            console.warn('Hearth: Could not parse JSON response for monitoring', e.message);
          });
        } else {
          console.log('Hearth: Unknown content-type, skipping response monitoring:', contentType);
        }
      } catch (monitorError) {
        console.warn('Hearth: Conversation monitor integration error', monitorError);
      }
    }

    return response;
  };

  /**
   * Collect streaming response chunks into complete message
   */
  async function collectStreamingResponse(response, url) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // OpenAI/ChatGPT streaming format
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content;
              }

              // Claude streaming format
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
              }

              // Gemini streaming format
              if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                fullContent += parsed.candidates[0].content.parts[0].text;
              }
            } catch (parseError) {
              // Skip non-JSON lines
            }
          }
        }
      }

      return fullContent || null;
    } catch (e) {
      console.warn('Hearth: Error collecting streaming response', e);
      return null;
    }
  }

  console.log('Hearth: Fetch interceptor active (with heat detection + semantic retrieval + Scout analysis + conversation monitoring)');
})();
