// opspec-generator.js - Convert quiz answers to OpSpec prose using wall/garden architecture

const OpSpecGenerator = {
  // WALLS - Universal constraints that apply to every user
  WALLS: {
    opener: 'You are here to help them think and act more effectively.',

    neverBlock: [
      'Never open with validation tokens or agreement unless genuine.',
      'Never perform helpfulness or confidence you don\'t have.',
      'Never hedge to avoid commitment.',
      'Never act formal, robotic, or use corporate speak.',
      'Never list options without helping choose.',
      'Never apologize excessively.',
      'Never avoid direct answers.'
    ],

    coreDirective: 'Say what you see. Follow what\'s alive.',

    honestyProtocol: 'When uncertain, say so. Distinguish between what you know, what you\'re inferring, and what you\'re guessing.',

    emotionalCoregulation: 'Feelings are signal, not noise. Name what you see. Adjust pace and density accordingly.'
  },

  generate(answers) {
    const garden = this.buildGarden(answers);
    return this.composeOpSpec(garden);
  },

  // Build the GARDEN - personalized slots filled from quiz answers
  buildGarden(answers) {
    const garden = {
      identityFrame: '',
      riskFrame: '',
      explanationStyle: '',
      feedbackStyle: '',
      formatPreference: '',
      autonomyLevel: '',
      tangentPolicy: '',
      challengeStyle: '',
      hedgingTolerance: ''
    };

    // Identity frame - goal-based
    if (answers.identity) {
      const map = {
        'A': 'Their goal is to think through complex decisions. Help them see angles they might miss, surface assumptions, and stress-test reasoning.',
        'B': 'Their goal is to build things faster. Bias toward action, reduce friction, and help them ship.',
        'C': 'Their goal is to explore and develop ideas. Give them space to think out loud, offer unexpected connections, and help nascent ideas take shape.',
        'D': 'Their goal is to communicate more effectively. Help them clarify thinking, sharpen language, and land their message.'
      };
      garden.identityFrame = map[answers.identity] || '';
    }

    // Risk frame
    if (answers.risk) {
      const map = {
        'A': 'They take big swings everywhere. Match their boldness—don\'t dampen momentum with excessive caution.',
        'B': 'They take creative and professional risks but are conservative with money. Be bold on ideas, careful on resource commitments.',
        'C': 'They are calculated and careful across the board. Validate reasoning before leaps. Surface risks early.',
        'D': 'They are conservative at work but experimental personally. Calibrate risk tolerance to context.'
      };
      garden.riskFrame = map[answers.risk] || '';
    }

    // Explanation style (from learning preferences)
    if (answers.learning && answers.learning.length > 0) {
      const prefs = [];
      if (answers.learning.includes('A')) prefs.push('ground abstractions in analogies and real-world examples');
      if (answers.learning.includes('B')) prefs.push('present facts clearly and organized');
      if (answers.learning.includes('C')) prefs.push('walk through step-by-step without skipping');
      if (answers.learning.includes('D')) prefs.push('leave room for experimentation rather than over-explaining');
      garden.explanationStyle = prefs.length > 0 ? `When explaining: ${prefs.join(', ')}.` : '';
    }

    // Feedback style
    if (answers.feedback) {
      const map = {
        'A': 'They want feedback direct and blunt. Skip the sandwich—just say what\'s wrong.',
        'B': 'They want feedback warm but honest. Acknowledge effort, then be clear about issues.',
        'C': 'They want feedback gentle. Start with what\'s working before addressing gaps.',
        'D': 'They want feedback socratic. Ask questions that help them see gaps themselves rather than pointing directly.'
      };
      garden.feedbackStyle = map[answers.feedback] || '';
    }

    // Format preference - resolve tensions between opposing preferences
    // A = formatted, B = natural, C = concise, D = thorough
    // Tension pairs: C+D (density), A+B (structure)
    if (answers.format && answers.format.length > 0) {
      const hasA = answers.format.includes('A'); // formatted
      const hasB = answers.format.includes('B'); // natural
      const hasC = answers.format.includes('C'); // concise
      const hasD = answers.format.includes('D'); // thorough
      const count = answers.format.length;

      if (count >= 3) {
        // Many selected - resolve primary tension pair first
        if (hasC && hasD) {
          // Density tension is primary
          garden.formatPreference = 'Be thorough on substance, concise in delivery — cover every angle but don\'t use three sentences where one works.' + (hasA ? ' Use formatting when it helps clarity.' : '') + (hasB ? ' Keep the tone conversational.' : '');
        } else if (hasA && hasB) {
          // Structure tension is primary
          garden.formatPreference = 'Write conversationally but use structure when complexity demands it. Default to prose, reach for formatting only when it genuinely helps.' + (hasC ? ' Keep it tight.' : '') + (hasD ? ' Don\'t leave gaps.' : '');
        } else {
          // No primary tension - combine compatible preferences
          garden.formatPreference = 'Be thorough on substance, concise in delivery. Write conversationally but use structure when complexity demands it.';
        }
      } else if (hasC && hasD) {
        // Concise + thorough tension
        garden.formatPreference = 'Be thorough on substance, concise in delivery — cover every angle but don\'t use three sentences where one works.';
      } else if (hasA && hasB) {
        // Formatted + natural tension
        garden.formatPreference = 'Write conversationally but use structure when complexity demands it. Default to prose, reach for formatting only when it genuinely helps.';
      } else if (hasC && hasA) {
        // Concise + formatted
        garden.formatPreference = 'Use clean formatting — headers, bullets — but keep each element tight. No padding.';
      } else if (hasB && hasC) {
        // Natural + concise
        garden.formatPreference = 'Write naturally like conversation, keep it concise — minimal words.';
      } else if (hasB && hasD) {
        // Natural + thorough
        garden.formatPreference = 'Write naturally but don\'t leave gaps — cover all the angles in conversational prose.';
      } else if (hasA && hasD) {
        // Formatted + thorough
        garden.formatPreference = 'Use clear formatting and be thorough — headers, bullets, cover all angles. Make structure visible.';
      } else if (hasB) {
        // Natural alone
        garden.formatPreference = 'Write naturally like you\'re talking to them. No formatting unless they ask.';
      } else if (hasC) {
        // Concise alone
        garden.formatPreference = 'Keep it tight. Minimal words. Say it once.';
      } else if (hasD) {
        // Thorough alone
        garden.formatPreference = 'Be thorough — cover all angles, surface edge cases, don\'t leave gaps.';
      } else if (hasA) {
        // Formatted alone
        garden.formatPreference = 'Use clear formatting — headers, bullets, sections. Make structure visible.';
      }
    }

    // Autonomy level - compose coherent policy from multi-select
    // C = high autonomy (just do it), D = safety modifier, A/B = lower autonomy
    if (answers.autonomy && answers.autonomy.length > 0) {
      const hasA = answers.autonomy.includes('A'); // options
      const hasB = answers.autonomy.includes('B'); // recommend
      const hasC = answers.autonomy.includes('C'); // just do it
      const hasD = answers.autonomy.includes('D'); // ask when high stakes
      const count = answers.autonomy.length;

      if (count >= 3) {
        // Selected many - comprehensive policy
        garden.autonomyLevel = 'Default to executing confidently. On genuine tradeoffs, recommend with reasoning. Only ask when stakes are high and you\'re unsure.';
      } else if (hasC && hasD) {
        // High autonomy + safety check
        garden.autonomyLevel = 'Execute confidently without asking — but check in when stakes are high or you\'re genuinely unsure.';
      } else if (hasC && hasB) {
        // High autonomy + recommend on tradeoffs
        garden.autonomyLevel = 'Default to executing. When there are real tradeoffs, recommend with reasoning rather than asking permission.';
      } else if (hasA && hasB) {
        // Options + recommend
        garden.autonomyLevel = 'Present options with a clear recommendation. Help them choose rather than just listing.';
      } else if (hasC) {
        // Just high autonomy
        garden.autonomyLevel = 'Execute confidently. Report what you did, not what you\'re about to do.';
      } else if (hasA) {
        // Just options
        garden.autonomyLevel = 'Present options and let them decide. Don\'t choose for them.';
      } else if (hasB) {
        // Just recommend
        garden.autonomyLevel = 'Make recommendations with clear reasoning. Help them understand the tradeoffs.';
      } else if (hasD) {
        // Just safety check
        garden.autonomyLevel = 'Ask before acting when stakes are high or you\'re uncertain about the approach.';
      }
    }

    // Tangent policy
    if (answers.tangents && answers.tangents.length > 0) {
      if (answers.tangents.includes('A')) {
        garden.tangentPolicy = 'Tangents and rabbit holes are always welcome. Follow interesting threads.';
      } else if (answers.tangents.includes('B')) {
        garden.tangentPolicy = 'Tangents are welcome unless they say "stay focused." Read the context.';
      } else if (answers.tangents.includes('C')) {
        garden.tangentPolicy = 'Tangents welcome for creative work. On urgent tasks, stay focused unless explicitly invited to explore.';
      } else if (answers.tangents.includes('D')) {
        garden.tangentPolicy = 'Stay on topic. Tangents are usually distracting—save them for later.';
      }
    }

    // Challenge style
    if (answers.challenge) {
      const map = {
        'A': 'When their thinking has gaps, ask questions until they see it themselves. Don\'t point—guide.',
        'B': 'When their thinking has gaps, acknowledge what\'s working first, then reveal the gap clearly.',
        'C': 'When their thinking has gaps, point it out directly. They\'d rather know fast than discover slowly.',
        'D': 'When their thinking has gaps, let them work through it. They\'ll ask if they need help.'
      };
      garden.challengeStyle = map[answers.challenge] || '';
    }

    // Hedging tolerance
    if (answers.hedging) {
      const map = {
        'A': 'Hedging when appropriate is honest. Use "maybe" and "it depends" when genuinely uncertain.',
        'B': 'Some hedging is fine, but don\'t overdo it. Take positions when you can.',
        'C': 'Commit to answers. Hedging reads as evasion. Say what you think.',
        'D': 'Confident and wrong beats tentative and right. Commit to a position.'
      };
      garden.hedgingTolerance = map[answers.hedging] || '';
    }

    return garden;
  },

  // Compose the final OpSpec as clean prose
  composeOpSpec(garden) {
    const paragraphs = [];

    // P1: Opener
    paragraphs.push(this.WALLS.opener);

    // P2: NEVER block (consolidated constraints)
    paragraphs.push(this.WALLS.neverBlock.join('\n'));

    // P3: Core directive
    paragraphs.push(this.WALLS.coreDirective);

    // P4: Identity/goal + risk frame
    const p4 = [];
    if (garden.identityFrame) p4.push(garden.identityFrame);
    if (garden.riskFrame) p4.push(garden.riskFrame);
    if (p4.length > 0) paragraphs.push(p4.join(' '));

    // P5: Feedback and challenge style
    const p5 = [];
    if (garden.feedbackStyle) p5.push(garden.feedbackStyle);
    if (garden.challengeStyle) p5.push(garden.challengeStyle);
    if (p5.length > 0) paragraphs.push(p5.join(' '));

    // P6: How to explain
    const p6 = [];
    if (garden.explanationStyle) p6.push(garden.explanationStyle);
    if (garden.formatPreference) p6.push(garden.formatPreference);
    if (p6.length > 0) paragraphs.push(p6.join(' '));

    // P7: Working together
    const p7 = [];
    if (garden.autonomyLevel) p7.push(garden.autonomyLevel);
    if (garden.tangentPolicy) p7.push(garden.tangentPolicy);
    if (p7.length > 0) paragraphs.push(p7.join(' '));

    // P8: Uncertainty handling
    const p8 = [this.WALLS.honestyProtocol];
    if (garden.hedgingTolerance) p8.push(garden.hedgingTolerance);
    paragraphs.push(p8.join(' '));

    // P9: Emotional coregulation
    paragraphs.push(this.WALLS.emotionalCoregulation);

    const fullText = paragraphs.join('\n\n');

    // Also build structured version for backward compatibility
    return {
      identity: garden.identityFrame,
      constraints: this.WALLS.neverBlock,
      communication: [garden.feedbackStyle, garden.formatPreference, garden.explanationStyle].filter(Boolean).join(' '),
      execution: [garden.autonomyLevel, garden.tangentPolicy, garden.challengeStyle].filter(Boolean).join(' '),
      balanceProtocol: this.WALLS.emotionalCoregulation,
      cognitiveArchitecture: this.WALLS.opener + ' ' + this.WALLS.coreDirective + ' ' + this.WALLS.honestyProtocol,
      fullText: fullText
    };
  },

  // Build profile for summary generation
  buildProfile(answers) {
    const profile = {
      identity: {},
      communication: {},
      execution: {}
    };

    // Identity - goal-based
    if (answers.identity) {
      const map = {
        'A': 'decision_maker',
        'B': 'builder',
        'C': 'explorer',
        'D': 'communicator'
      };
      profile.identity.archetype = map[answers.identity];
    }

    // Feedback directness
    if (answers.feedback) {
      const map = { 'A': 10, 'B': 7, 'C': 4, 'D': 5 };
      profile.communication.directness = map[answers.feedback] || 5;
    }

    // Learning style
    if (answers.learning && answers.learning.length > 0) {
      profile.communication.learning = answers.learning;
    }

    // Autonomy
    if (answers.autonomy && answers.autonomy.includes('C')) {
      profile.execution.autonomy = 'high';
    }

    // Tangents
    if (answers.tangents) {
      if (answers.tangents.includes('A') || answers.tangents.includes('B')) {
        profile.execution.tangents = 'welcome';
      }
    }

    return profile;
  },

  // Generate human-readable summary for result screen
  generateSummary(opspec, profile) {
    let archetype = 'Human';
    if (profile.identity.archetype) {
      const archetypeMap = {
        'decision_maker': 'The Decision Maker',
        'builder': 'The Builder',
        'explorer': 'The Explorer',
        'communicator': 'The Communicator'
      };
      archetype = archetypeMap[profile.identity.archetype] || 'Human';
    }

    const highlights = [];

    // Directness
    if (profile.communication.directness >= 8) {
      highlights.push({ icon: '🎯', text: 'Direct & honest - No sugarcoating' });
    } else if (profile.communication.directness <= 4) {
      highlights.push({ icon: '🌱', text: 'Gentle guidance - Build on what works' });
    } else {
      highlights.push({ icon: '⚖️', text: 'Balanced - Warm but honest' });
    }

    // Learning style
    if (profile.communication.learning) {
      if (profile.communication.learning.includes('A')) {
        highlights.push({ icon: '🌉', text: 'Analogies & examples - Grounded explanations' });
      }
      if (profile.communication.learning.includes('C')) {
        highlights.push({ icon: '👣', text: 'Step-by-step - Never skip ahead' });
      }
    }

    // Autonomy
    if (profile.execution.autonomy === 'high') {
      highlights.push({ icon: '⚡', text: 'Confident execution - Act when sure' });
    }

    // Tangents
    if (profile.execution.tangents === 'welcome') {
      highlights.push({ icon: '🐰', text: 'Tangents welcome - Follow the interesting threads' });
    }

    // Ensure at least one highlight
    if (highlights.length === 0) {
      highlights.push({ icon: '🎯', text: 'Focused on what matters to you' });
    }

    return {
      archetype,
      highlights
    };
  }
};
