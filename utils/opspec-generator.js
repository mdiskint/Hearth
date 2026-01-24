// opspec-generator.js - Convert quiz answers to OpSpec prose

const OpSpecGenerator = {
  
  generate(answers) {
    const profile = this.buildProfile(answers);
    const opspec = this.buildOpSpec(profile);
    return opspec;
  },
  
  buildProfile(answers) {
    const profile = {
      identity: {},
      communication: {},
      execution: {},
      constraints: [],
      patterns: {}
    };
    
    // Q1: Identity archetype
    if (answers.q1) {
      const map = {
        'A': { type: 'technical_expert', desc: 'a technical expert in my field' },
        'B': { type: 'vibe_coder', desc: 'ambitious and learning as I go—a vibe coder' },
        'C': { type: 'creative_experimenter', desc: 'a creative experimenter who learns by building' },
        'D': { type: 'strategic_planner', desc: 'a strategic planner who thinks several steps ahead' }
      };
      profile.identity.archetype = map[answers.q1].desc;
    }
    
    // Q2: Risk profile
    if (answers.q2) {
      const map = {
        'A': 'I take big swings everywhere',
        'B': 'I take creative and professional risks but I\'m conservative with money',
        'C': 'I\'m calculated and careful across the board',
        'D': 'I\'m conservative at work but wild in my personal life'
      };
      profile.identity.risk = map[answers.q2];
    }
    
    // Q3: Learning preferences (multi-select)
    if (answers.q3 && answers.q3.length > 0) {
      const prefs = [];
      if (answers.q3.includes('A')) {
        prefs.push('analogies and real-world examples');
        profile.constraints.push('Never use pure abstraction without grounding');
      }
      if (answers.q3.includes('B')) prefs.push('facts organized clearly');
      if (answers.q3.includes('C')) {
        prefs.push('step-by-step walkthroughs');
        profile.constraints.push('Never skip steps or assume prior knowledge');
      }
      if (answers.q3.includes('D')) {
        prefs.push('space to experiment and figure things out');
        profile.constraints.push('Never over-explain when I can learn by doing');
      }
      profile.communication.learning = prefs;
    }
    
    // Q4: Feedback style (multi-select)
    if (answers.q4 && answers.q4.length > 0) {
      const styles = answers.q4;
      
      if (styles.includes('A')) {
        profile.constraints.push('Never sugarcoat feedback - be direct and blunt');
      }
      if (styles.includes('C') && !styles.includes('A')) {
        profile.constraints.push('Never lead with criticism - start with what\'s working');
      }
      if (styles.includes('A') && styles.includes('C')) {
        profile.constraints.push('Acknowledge what\'s working first, then be direct about issues');
      }
      if (styles.includes('B')) {
        profile.communication.feedbackStyle = 'warm but honest';
      }
      if (styles.includes('D')) {
        profile.communication.feedbackStyle = 'socratic - help me see it myself';
      }
    }
    
    // Q5: Formatting preferences (multi-select)
    if (answers.q5 && answers.q5.length > 0) {
      const formats = answers.q5;
      
      if (formats.includes('B') && !formats.includes('A')) {
        profile.constraints.push('Never use excessive formatting (headers, bullets) unless explicitly requested');
      }
      if (formats.includes('D') && formats.includes('B')) {
        profile.communication.style = 'Cover all angles in natural prose - comprehensive but conversational';
      }
      if (formats.includes('C') && formats.includes('D')) {
        profile.communication.style = 'Comprehensive but tight - complete information, efficiently expressed';
      }
      if (formats.includes('C') && !formats.includes('D')) {
        profile.constraints.push('Never ramble - keep it concise');
      }
      if (formats.includes('A')) {
        profile.communication.formatting = 'structured with headers and bullets';
      }
    }
    
    // Q6: Communication style (max 2)
    if (answers.q6 && answers.q6.length > 0) {
      const styles = answers.q6;
      if (styles.includes('A')) {
        profile.constraints.push('Never use corporate or robotic language');
        profile.communication.tone = 'natural and conversational';
      }
      if (styles.includes('B')) {
        profile.communication.tone = 'professional and structured';
      }
      if (styles.includes('C')) {
        profile.communication.tone = 'warm and encouraging';
      }
      if (styles.includes('D')) {
        profile.communication.tone = 'efficient and minimal';
      }
    }
    
    // Q7: Uncertainty handling
    if (answers.q7) {
      const map = {
        'A': { constraint: 'Never express false confidence when uncertain - say so clearly', tone: 'honest about limits' },
        'B': { constraint: 'Don\'t overdo hedging, but be honest when uncertain', tone: 'balanced confidence' },
        'C': { tone: 'confident by default' },
        'D': { tone: 'commit to answers even when guessing' }
      };
      if (map[answers.q7].constraint) {
        profile.constraints.push(map[answers.q7].constraint);
      }
    }
    
    // Q8: Directness calibration
    if (answers.q8) {
      const map = {
        'A': { directness: 3 },
        'B': { directness: 7 },
        'C': { directness: 10 },
        'D': { directness: 1 }
      };
      profile.communication.directness = map[answers.q8].directness;
    }
    
    // Q9: Problem-solving approach
    if (answers.q9) {
      const map = {
        'A': 'Know when to suggest taking a break',
        'B': 'Support experimentation and trying different approaches',
        'C': 'Help me think through problems by externalizing',
        'D': 'Support fresh starts when frustration is high'
      };
      profile.execution.problemSolving = map[answers.q9];
    }
    
    // Q10: Decision-making (multi-select)
    if (answers.q10 && answers.q10.length > 0) {
      const prefs = answers.q10;
      if (prefs.includes('A')) {
        profile.constraints.push('Never decide for me without presenting options');
        profile.execution.decisions = 'Give me options and let me decide';
      }
      if (prefs.includes('D') || prefs.includes('C')) {
        profile.execution.autonomy = 'Execute confidently when you\'re sure';
      }
      if (prefs.includes('B')) {
        profile.execution.guidance = 'Make recommendations and explain why';
      }
    }
    
    // Q11: When to ask (multi-select)
    if (answers.q11 && answers.q11.length > 0) {
      const conditions = [];
      if (answers.q11.includes('A')) conditions.push('uncertain about the approach');
      if (answers.q11.includes('B')) conditions.push('high-stakes or expensive');
      if (answers.q11.includes('C')) conditions.push('first time seeing this type of task');
      if (answers.q11.includes('D')) {
        profile.execution.askWhen = 'Never - just do it and tell me after';
      } else if (conditions.length > 0) {
        profile.execution.askWhen = `Ask before acting when: ${conditions.join(', OR when ')}. Otherwise execute confidently.`;
      }
    }
    
    // Q12: Tangents (multi-select)
    if (answers.q12 && answers.q12.length > 0) {
      const prefs = answers.q12;
      if (prefs.includes('A')) {
        profile.execution.tangents = 'Embrace tangents and exploration - always welcome';
      } else if (prefs.includes('B')) {
        profile.execution.tangents = 'Tangents and rabbit holes are welcome unless I explicitly say "stay focused"';
      } else if (prefs.includes('C')) {
        profile.execution.tangents = 'Embrace tangents for creative work. Stay focused on urgent tasks unless explicitly invited to explore';
      } else if (prefs.includes('D')) {
        profile.execution.tangents = 'Stay on topic - tangents are usually distracting';
      }
    }
    
    // Q13: Rapid-fire patterns
    if (answers.q13) {
      profile.patterns.priorities = answers.q13;
    }
    
    // Q14: Hedging tolerance
    if (answers.q14) {
      const map = {
        'B': 'Don\'t hedge excessively',
        'C': 'Never hedge - commit to an answer',
        'D': 'Be confident even when uncertain'
      };
      if (map[answers.q14]) {
        profile.constraints.push(map[answers.q14]);
      }
    }
    
    // Q15: Dealbreakers (multi-select)
    if (answers.q15 && answers.q15.length > 0) {
      const dealbreakers = answers.q15;
      if (dealbreakers.includes('A')) profile.constraints.push('Never act confident while clearly guessing');
      if (dealbreakers.includes('B')) profile.constraints.push('Never overwhelm with options without helping choose');
      if (dealbreakers.includes('C')) profile.constraints.push('Never use overly formal or robotic language');
      if (dealbreakers.includes('D')) profile.constraints.push('Never apologize excessively');
      if (dealbreakers.includes('E')) profile.constraints.push('Never use corporate speak and buzzwords');
      if (dealbreakers.includes('F')) profile.constraints.push('Never avoid giving direct answers');
    }
    
    return profile;
  },
  
  buildOpSpec(profile) {
    // Build identity section
    let identity = `I'm ${profile.identity.archetype}. ${profile.identity.risk}.`;
    
    if (profile.communication.learning && profile.communication.learning.length > 0) {
      identity += ` I learn best through ${profile.communication.learning.join(', ')}.`;
    }
    
    // Build constraints section
    const constraints = profile.constraints.length > 0 
      ? profile.constraints 
      : ['Never make assumptions about what I want without asking'];
    
    // Build communication section
    let communication = '';
    if (profile.communication.tone) {
      communication += `${profile.communication.tone.charAt(0).toUpperCase() + profile.communication.tone.slice(1)}. `;
    }
    if (profile.communication.style) {
      communication += `${profile.communication.style}. `;
    }
    if (profile.communication.feedbackStyle) {
      communication += `Feedback style: ${profile.communication.feedbackStyle}. `;
    }
    
    // Build execution section
    let execution = '';
    if (profile.execution.decisions) {
      execution += `${profile.execution.decisions}. `;
    }
    if (profile.execution.guidance) {
      execution += `${profile.execution.guidance}. `;
    }
    if (profile.execution.askWhen) {
      execution += `${profile.execution.askWhen}. `;
    }
    if (profile.execution.tangents) {
      execution += `${profile.execution.tangents}. `;
    }
    if (profile.execution.problemSolving) {
      execution += `${profile.execution.problemSolving}. `;
    }
    
    // Return structured OpSpec
    return {
      identity: identity.trim(),
      constraints: constraints,
      communication: communication.trim() || 'Natural and conversational. Be honest when uncertain.',
      execution: execution.trim() || 'Ask when confused, execute when confident.',
      balanceCheck: 'Does this expand or collapse the space of who I can safely become? Growth expands. Drift collapses.'
    };
  },
  
  // Generate human-readable summary for result screen
  generateSummary(opspec, profile) {
    let archetype = 'Human';
    if (profile.identity.archetype) {
      if (profile.identity.archetype.includes('vibe coder')) archetype = 'The Ambitious Explorer';
      else if (profile.identity.archetype.includes('technical expert')) archetype = 'The Technical Expert';
      else if (profile.identity.archetype.includes('creative experimenter')) archetype = 'The Creative Builder';
      else if (profile.identity.archetype.includes('strategic planner')) archetype = 'The Strategic Thinker';
    }
    
    const highlights = [];
    
    // Directness
    if (profile.communication.directness >= 8) {
      highlights.push({ icon: '🎯', text: 'Direct & honest - No sugarcoating' });
    } else if (profile.communication.directness <= 3) {
      highlights.push({ icon: '🤝', text: 'Warm & supportive - Gentle guidance' });
    } else {
      highlights.push({ icon: '⚖️', text: 'Balanced - Warm but honest' });
    }
    
    // Learning style
    if (profile.communication.learning && profile.communication.learning.includes('analogies')) {
      highlights.push({ icon: '🧠', text: 'Analogies & walkthroughs - Step-by-step explanations' });
    }
    
    // Execution
    if (profile.execution.autonomy) {
      highlights.push({ icon: '⚡', text: 'Confident execution - Act when sure, ask when not' });
    }
    
    // Tangents
    if (profile.execution.tangents && profile.execution.tangents.includes('welcome')) {
      highlights.push({ icon: '🌊', text: 'Embrace tangents - Exploration encouraged' });
    }
    
    return {
      archetype,
      highlights
    };
  }
};
