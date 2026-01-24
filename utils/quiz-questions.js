// quiz-questions.js - The 15 personality questions

const QUIZ_QUESTIONS = [
  // SECTION 1: IDENTITY
  {
    id: 'q1',
    section: 'identity',
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
    id: 'q2',
    section: 'identity',
    text: "When it comes to risk:",
    type: 'single',
    answers: [
      { id: 'A', text: 'I take big swings everywhere', emoji: '🎲' },
      { id: 'B', text: 'Bold with creative/work stuff, careful with money', emoji: '⚖️' },
      { id: 'C', text: 'Calculated and careful across the board', emoji: '🛡️' },
      { id: 'D', text: 'Conservative at work, wild in personal life', emoji: '🎭' }
    ]
  },
  
  {
    id: 'q3',
    section: 'identity',
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
  
  // SECTION 2: COMMUNICATION
  {
    id: 'q4',
    section: 'communication',
    text: "The kind of feedback that actually helps me is:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'Direct and blunt - just tell me what\'s wrong', emoji: '🎯' },
      { id: 'B', text: 'Balanced - warm but honest', emoji: '🤝' },
      { id: 'C', text: 'Gentle - start with what\'s working', emoji: '🌱' },
      { id: 'D', text: 'Socratic - help me see it myself', emoji: '🤔' }
    ]
  },
  
  {
    id: 'q5',
    section: 'communication',
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
  
  {
    id: 'q6',
    section: 'communication',
    text: "The communication style that resonates with me is:",
    type: 'multi',
    instruction: 'Pick your top 2',
    maxSelections: 2,
    answers: [
      { id: 'A', text: 'Natural and conversational', emoji: '🗣️' },
      { id: 'B', text: 'Professional and structured', emoji: '👔' },
      { id: 'C', text: 'Warm and encouraging', emoji: '☀️' },
      { id: 'D', text: 'Efficient and minimal', emoji: '⏱️' }
    ]
  },
  
  {
    id: 'q7',
    section: 'communication',
    text: "When someone says \"I don't know\" or \"I'm not sure\":",
    type: 'single',
    answers: [
      { id: 'A', text: 'I respect that - honesty over fake confidence', emoji: '✅' },
      { id: 'B', text: 'It\'s fine occasionally but don\'t overdo it', emoji: '⚠️' },
      { id: 'C', text: 'It makes me lose confidence in them', emoji: '📉' },
      { id: 'D', text: 'I prefer they make their best guess anyway', emoji: '🎲' }
    ]
  },
  
  // SECTION 3: EXECUTION
  {
    id: 'q8',
    section: 'execution',
    text: "Your friend asks for feedback on their startup idea. It's... not good. You:",
    type: 'single',
    answers: [
      { id: 'A', text: 'Help them see the gaps through questions', emoji: '🤔' },
      { id: 'B', text: 'Be honest but warm: "Love it, but here are 5 issues"', emoji: '🤝' },
      { id: 'C', text: 'Be direct: "This won\'t work" and explain why', emoji: '💣' },
      { id: 'D', text: 'Hype them up - they\'ll figure it out', emoji: '🎉' }
    ]
  },
  
  {
    id: 'q9',
    section: 'execution',
    text: "It's 2am. Your code doesn't work. You've tried everything. You:",
    type: 'single',
    answers: [
      { id: 'A', text: 'Walk away - fresh eyes tomorrow', emoji: '🚶' },
      { id: 'B', text: 'Keep trying different things', emoji: '🔄' },
      { id: 'C', text: 'Ask for help/Google it', emoji: '🆘' },
      { id: 'D', text: 'Burn it down and start over', emoji: '🔥' }
    ]
  },
  
  {
    id: 'q10',
    section: 'execution',
    text: "When I'm working with someone, I appreciate when they:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'Give me options and let me decide', emoji: '🎯' },
      { id: 'B', text: 'Make a recommendation and explain why', emoji: '💡' },
      { id: 'C', text: 'Just tell me what to do when confident', emoji: '👉' },
      { id: 'D', text: 'Handle it themselves if they\'re sure', emoji: '✅' }
    ]
  },
  
  {
    id: 'q11',
    section: 'execution',
    text: "You should ask before doing something when:",
    type: 'multi',
    instruction: 'Select all that apply',
    answers: [
      { id: 'A', text: 'You\'re uncertain about the approach', emoji: '❓' },
      { id: 'B', text: 'It\'s high-stakes or expensive', emoji: '💰' },
      { id: 'C', text: 'It\'s my first time seeing this type of task', emoji: '🆕' },
      { id: 'D', text: 'Never - just do it and tell me after', emoji: '⚡' }
    ]
  },
  
  {
    id: 'q12',
    section: 'execution',
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
  
  // SECTION 4: DEALBREAKERS
  {
    id: 'q13',
    section: 'preferences',
    text: "Pick one for each pair:",
    type: 'pairs',
    pairs: [
      { 
        id: 'row1',
        left: { id: 'A', text: 'Get it done', emoji: '🎯' },
        right: { id: 'B', text: 'Understand deeply', emoji: '🔍' }
      },
      { 
        id: 'row2',
        left: { id: 'A', text: 'Explore tangents', emoji: '🌊' },
        right: { id: 'B', text: 'Stay focused', emoji: '🎯' }
      },
      { 
        id: 'row3',
        left: { id: 'A', text: 'Creative chaos', emoji: '🎨' },
        right: { id: 'B', text: 'Structured approach', emoji: '📐' }
      },
      { 
        id: 'row4',
        left: { id: 'A', text: 'Move fast', emoji: '⚡' },
        right: { id: 'B', text: 'Careful and thorough', emoji: '🔬' }
      }
    ]
  },
  
  {
    id: 'q14',
    section: 'preferences',
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
    id: 'q15',
    section: 'dealbreakers',
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
