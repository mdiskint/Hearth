// quiz-questions.js - The 10 personality questions

const QUIZ_QUESTIONS = [
  // SECTION 1: WHO YOU ARE
  {
    id: 'identity',
    section: 'who_you_are',
    text: "First, tell me about yourself. You're:",
    type: 'single',
    answers: [
      { id: 'A', text: 'A technical expert in my field', emoji: '🔬' },
      { id: 'B', text: 'Ambitious and learning as I go (vibe coder energy)', emoji: '🚀' },
      { id: 'C', text: 'A creative experimenter - I learn by building', emoji: '🎨' },
      { id: 'D', text: 'A strategic planner - I think several steps ahead', emoji: '♟️' }
    ]
  },

  {
    id: 'risk',
    section: 'who_you_are',
    text: "When it comes to risk:",
    type: 'single',
    answers: [
      { id: 'A', text: 'I take big swings everywhere', emoji: '🎲' },
      { id: 'B', text: 'Bold with creative/work stuff, careful with money', emoji: '⚖️' },
      { id: 'C', text: 'Calculated and careful across the board', emoji: '🛡️' },
      { id: 'D', text: 'Conservative at work, wild in personal life', emoji: '🎭' }
    ]
  },

  // SECTION 2: HOW YOU LEARN
  {
    id: 'learning',
    section: 'how_you_learn',
    text: "When I'm learning something new and technical:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'I need analogies and real-world examples', emoji: '🌉' },
      { id: 'B', text: 'Just give me the facts, organized clearly', emoji: '📊' },
      { id: 'C', text: 'Walk me through step-by-step', emoji: '👣' },
      { id: 'D', text: 'Let me experiment and figure it out', emoji: '🔬' }
    ]
  },

  {
    id: 'feedback',
    section: 'how_you_learn',
    text: "The kind of feedback that actually helps me is:",
    type: 'single',
    answers: [
      { id: 'A', text: 'Direct and blunt - just tell me what\'s wrong', emoji: '🎯' },
      { id: 'B', text: 'Balanced - warm but honest', emoji: '🤝' },
      { id: 'C', text: 'Gentle - start with what\'s working', emoji: '🌱' },
      { id: 'D', text: 'Socratic - help me see it myself', emoji: '🤔' }
    ]
  },

  {
    id: 'format',
    section: 'how_you_learn',
    text: "When you're explaining something, I love when you:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'Use lots of formatting - headers, bullets, sections', emoji: '📋' },
      { id: 'B', text: 'Just write naturally like you\'re talking to me', emoji: '💬' },
      { id: 'C', text: 'Keep it super concise - minimal words', emoji: '⚡' },
      { id: 'D', text: 'Be thorough - cover all the angles', emoji: '🔍' }
    ]
  },

  // SECTION 3: HOW WE WORK
  {
    id: 'autonomy',
    section: 'how_we_work',
    text: "When working together, I want you to:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'Give me options and let me decide', emoji: '🎯' },
      { id: 'B', text: 'Recommend what you\'d do and explain why', emoji: '💡' },
      { id: 'C', text: 'Just do it if you\'re confident - tell me after', emoji: '⚡' },
      { id: 'D', text: 'Ask me first when stakes are high or you\'re unsure', emoji: '🤝' }
    ]
  },

  {
    id: 'tangents',
    section: 'how_we_work',
    text: "Tangents and rabbit holes:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'Love them - always explore', emoji: '🐰' },
      { id: 'B', text: 'Fine unless I say "stay focused"', emoji: '🎯' },
      { id: 'C', text: 'Great for creative work, not urgent tasks', emoji: '🎨' },
      { id: 'D', text: 'Usually distracting - stay on topic', emoji: '⛔' }
    ]
  },

  {
    id: 'challenge',
    section: 'how_we_work',
    text: "When my thinking has a gap, I want you to:",
    type: 'single',
    answers: [
      { id: 'A', text: 'Ask me questions until I see it myself', emoji: '🤔' },
      { id: 'B', text: 'Tell me what\'s working, then show me the gap', emoji: '🤝' },
      { id: 'C', text: 'Point it out directly - I\'d rather know fast', emoji: '💣' },
      { id: 'D', text: 'Let me figure it out - I\'ll ask if I need help', emoji: '🔬' }
    ]
  },

  // SECTION 4: BRIGHT LINES
  {
    id: 'hedging',
    section: 'bright_lines',
    text: "When someone hedges everything with \"maybe\" and \"it depends\":",
    type: 'single',
    answers: [
      { id: 'A', text: 'That\'s honest and appropriate', emoji: '✅' },
      { id: 'B', text: 'A little is fine, too much is annoying', emoji: '⚠️' },
      { id: 'C', text: 'Just commit to an answer', emoji: '💪' },
      { id: 'D', text: 'I\'d rather confident and wrong than tentative and right', emoji: '🎲' }
    ]
  },

  {
    id: 'dealbreakers',
    section: 'bright_lines',
    text: "I'd close the tab if an AI:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'Acts confident while clearly guessing', emoji: '🎭' },
      { id: 'B', text: 'Gives me 10 options without helping choose', emoji: '😵' },
      { id: 'C', text: 'Uses overly formal/robotic language', emoji: '🤖' },
      { id: 'D', text: 'Apologizes excessively', emoji: '🙏' },
      { id: 'E', text: 'Uses corporate speak and buzzwords', emoji: '💼' },
      { id: 'F', text: 'Avoids giving direct answers', emoji: '🌫️' }
    ]
  }
];
