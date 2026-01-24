// heatDetector.js - Analyze query emotional intensity for memory relevance weighting

/**
 * Heat patterns organized by intensity level
 * Each pattern uses word boundaries for accurate matching
 */
const HEAT_PATTERNS = {
  // HOT (0.6 - 1.0): Crisis, anxiety, deep personal struggles
  hot: {
    baseScore: 0.6,
    maxScore: 1.0,
    patterns: [
      // Crisis/emergency
      /\b(crisis|emergency|urgent|desperate|can't cope|falling apart)\b/i,
      /\b(suicidal|self.?harm|want to die|end it all|no way out)\b/i,
      /\b(panic|panicking|panic attack|can't breathe|heart racing)\b/i,

      // Intense fear/anxiety
      /\b(terrified|petrified|paralyzed|frozen|dread)\b/i,
      /\b(overwhelming|can't handle|too much|breaking down)\b/i,
      /\b(scared|frightened|afraid)\s+(to death|out of my mind)\b/i,

      // Deep personal struggle
      /\b(don't know what to do|lost|hopeless|helpless|worthless)\b/i,
      /\b(failing|failure|screwed up|ruined|destroyed)\b/i,
      /\b(hate myself|hate my life|can't go on|giving up)\b/i,
      /\b(betrayed|abandoned|alone|no one understands)\b/i,

      // Relationship crisis
      /\b(divorce|cheating|affair|leaving me|broke up)\b/i,
      /\b(abusive|toxic|manipulative|gaslighting)\b/i,

      // Major life disruption
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
      // Decision making
      /\b(thinking about|considering|debating|torn between)\b/i,
      /\b(should I|what should I|do you think I should)\b/i,
      /\b(pros and cons|weighing options|difficult decision)\b/i,
      /\b(not sure if|can't decide|conflicted)\b/i,

      // Life transitions
      /\b(career change|new job|job offer|promotion)\b/i,
      /\b(moving|relocating|new city|leaving)\b/i,
      /\b(relationship|dating|getting married|having kids)\b/i,
      /\b(starting|quitting|beginning|ending)\b/i,

      // Personal growth/struggle
      /\b(struggling with|working on|trying to)\b/i,
      /\b(frustrated|confused|uncertain|worried|anxious)\b/i,
      /\b(need advice|need help|seeking guidance)\b/i,
      /\b(want to improve|want to change|want to grow)\b/i,

      // Values/identity
      /\b(believe in|values|principles|what matters)\b/i,
      /\b(who I am|identity|purpose|meaning)\b/i,
      /\b(feel like|feeling|emotions|emotional)\b/i,

      // Interpersonal
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
      // How-to queries
      /\b(how do I|how to|how can I|how would I)\b/i,
      /\b(what's the|what is the|what are the)\b/i,
      /\b(where can I|where do I|where is)\b/i,
      /\b(when should I|when do I|when is)\b/i,

      // Help with tasks
      /\b(help me with|help me understand|explain)\b/i,
      /\b(can you show|can you help|can you explain)\b/i,
      /\b(teach me|learn about|understand)\b/i,

      // Information seeking
      /\b(looking for|searching for|trying to find)\b/i,
      /\b(difference between|compare|comparison)\b/i,
      /\b(recommend|suggestion|best way to)\b/i,
      /\b(example|examples|sample|template)\b/i,

      // Technical/practical
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
      // Greetings
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i,
      /\b(how are you|what's up|howdy)\b/i,

      // Simple requests
      /^(thanks|thank you|thx|ty)\b/i,
      /\b(please|pls)\s+(and\s+)?(thanks|thank you)/i,
      /^(ok|okay|sure|got it|sounds good)\b/i,

      // Acknowledgments
      /^(yes|no|maybe|correct|right|wrong)\b/i,
      /\b(makes sense|I see|understood|noted)\b/i,

      // Casual/meta
      /\b(testing|test|ignore|never mind|nvm)\b/i,
      /\b(just wondering|curious|random question)\b/i,
      /^(what|who|why)\s*\?*$/i  // Very short questions
    ]
  }
};

/**
 * Intensity boosters - patterns that increase heat within a category
 */
const INTENSITY_BOOSTERS = [
  { pattern: /\b(really|very|extremely|incredibly|absolutely|totally)\b/i, boost: 0.1 },
  { pattern: /\b(always|never|every time|constantly)\b/i, boost: 0.08 },
  { pattern: /\b(need to|have to|must|can't)\b/i, boost: 0.05 },
  { pattern: /!{2,}/g, boost: 0.1 },  // Multiple exclamation marks
  { pattern: /\?{2,}/g, boost: 0.05 }, // Multiple question marks
  { pattern: /\b[A-Z]{3,}\b/g, boost: 0.05 }, // ALL CAPS words
  { pattern: /\.{3,}/g, boost: 0.03 }  // Ellipses (uncertainty)
];

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
  const matches = {
    hot: 0,
    warm: 0,
    cool: 0,
    cold: 0
  };

  // Count pattern matches in each category
  for (const [category, config] of Object.entries(HEAT_PATTERNS)) {
    for (const pattern of config.patterns) {
      const found = text.match(pattern);
      if (found) {
        matches[category]++;
      }
    }
  }

  // Determine primary category and base score
  let baseScore = 0.0;
  let maxScore = 0.1;

  // Priority: hot > warm > cool > cold
  // More matches = higher score within range
  if (matches.hot > 0) {
    baseScore = HEAT_PATTERNS.hot.baseScore;
    maxScore = HEAT_PATTERNS.hot.maxScore;
    // Scale within range based on match count
    const matchBonus = Math.min(matches.hot - 1, 3) * 0.1;
    baseScore = Math.min(baseScore + matchBonus, maxScore);
  } else if (matches.warm > 0) {
    baseScore = HEAT_PATTERNS.warm.baseScore;
    maxScore = HEAT_PATTERNS.warm.maxScore;
    const matchBonus = Math.min(matches.warm - 1, 3) * 0.08;
    baseScore = Math.min(baseScore + matchBonus, maxScore);
  } else if (matches.cool > 0) {
    baseScore = HEAT_PATTERNS.cool.baseScore;
    maxScore = HEAT_PATTERNS.cool.maxScore;
    const matchBonus = Math.min(matches.cool - 1, 2) * 0.05;
    baseScore = Math.min(baseScore + matchBonus, maxScore);
  } else if (matches.cold > 0) {
    baseScore = HEAT_PATTERNS.cold.baseScore;
    maxScore = HEAT_PATTERNS.cold.maxScore;
  } else {
    // No patterns matched - default to cool (informational)
    baseScore = 0.15;
    maxScore = 0.25;
  }

  // Apply intensity boosters
  let boost = 0;
  for (const booster of INTENSITY_BOOSTERS) {
    const found = text.match(booster.pattern);
    if (found) {
      // Multiple matches of same booster have diminishing returns
      const matchCount = Array.isArray(found) ? found.length : 1;
      boost += booster.boost * Math.min(matchCount, 2);
    }
  }

  // Apply boost but don't exceed max score
  let finalScore = baseScore + boost;
  finalScore = Math.min(finalScore, maxScore);

  // Also cap at 1.0 absolute max
  finalScore = Math.min(finalScore, 1.0);

  // Round to 2 decimal places
  return Math.round(finalScore * 100) / 100;
}

/**
 * Get a human-readable heat level label
 * @param {number} heat - Heat score 0.0 to 1.0
 * @returns {string} Heat level label
 */
function getHeatLabel(heat) {
  if (heat >= 0.6) return 'hot';
  if (heat >= 0.3) return 'warm';
  if (heat >= 0.1) return 'cool';
  return 'cold';
}

/**
 * Test function to validate heat detection on sample queries
 */
function testHeatDetector() {
  const testCases = [
    // Hot (0.6-1.0)
    "I'm terrified and don't know what to do anymore",
    "I think I'm having a panic attack, can't breathe",
    "My partner just told me they've been cheating",
    "I got fired today and I'm completely falling apart",
    "I feel like such a failure, I hate myself",

    // Warm (0.3-0.6)
    "I'm thinking about a career change, should I take the risk?",
    "Feeling really frustrated with my relationship lately",
    "I'm torn between two job offers, need advice",
    "Struggling with setting boundaries with my family",
    "I want to improve my communication skills",

    // Cool (0.1-0.3)
    "How do I create a budget spreadsheet?",
    "Can you explain the difference between REST and GraphQL?",
    "Help me understand how to use async/await in JavaScript",
    "What's the best way to learn Python?",
    "Looking for examples of good resume formatting",

    // Cold (0-0.1)
    "Hi there!",
    "Thanks for your help",
    "Ok, sounds good",
    "Hello, how are you?",
    "Just testing"
  ];

  console.log('=== Heat Detector Test Results ===\n');

  for (const query of testCases) {
    const heat = detectQueryHeat(query);
    const label = getHeatLabel(heat);
    const bar = '█'.repeat(Math.round(heat * 20)) + '░'.repeat(20 - Math.round(heat * 20));

    console.log(`[${heat.toFixed(2)}] ${label.toUpperCase().padEnd(4)} ${bar}`);
    console.log(`  "${query.substring(0, 60)}${query.length > 60 ? '...' : ''}"`);
    console.log('');
  }

  // Test intensity boosters
  console.log('=== Intensity Booster Tests ===\n');

  const boosterTests = [
    ["I'm worried", "I'm REALLY worried!!!", "Baseline vs boosted"],
    ["Should I change jobs?", "Should I change jobs??? I NEED to decide!!!", "Baseline vs boosted"],
    ["Help me with this", "HELP ME WITH THIS!!!", "Baseline vs boosted"]
  ];

  for (const [baseline, boosted, label] of boosterTests) {
    const baseHeat = detectQueryHeat(baseline);
    const boostHeat = detectQueryHeat(boosted);
    console.log(`${label}:`);
    console.log(`  Baseline: "${baseline}" → ${baseHeat.toFixed(2)}`);
    console.log(`  Boosted:  "${boosted}" → ${boostHeat.toFixed(2)}`);
    console.log(`  Increase: +${(boostHeat - baseHeat).toFixed(2)}`);
    console.log('');
  }
}
