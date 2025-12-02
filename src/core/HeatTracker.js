/**
 * HeatTracker - Manages dimensional activation for Hearth
 * 
 * Tracks which dimensions (domains + emotions) are "hot" in a conversation.
 * Heat builds with repeated activation and decays without reinforcement.
 */

export class HeatTracker {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      initialHeat: 0.4,           // Starting heat for first activation (warm immediately)
      heatIncrement: 0.15,        // How much heat builds per activation
      heatDecay: 0.03,            // How much heat decays per turn without activation
      maxHeat: 1.0,               // Maximum heat level
      minHeat: 0.0,               // Minimum heat level
      coldThreshold: 0.1,         // Below this, dimension is considered cold
      warmThreshold: 0.3,         // Above this, dimension is considered warm
      hotThreshold: 0.6,          // Above this, dimension is considered hot
      ...config
    };

    // Heat state for all dimensions
    this.domainHeat = {
      Work: 0,
      Relationships: 0,
      Creative: 0,
      Self: 0,
      Decisions: 0,
      Resources: 0
    };

    this.emotionHeat = {
      Fear: 0,
      Anger: 0,
      Shame: 0,
      Grief: 0,
      Anxiety: 0,
      Joy: 0,
      Pride: 0,
      Love: 0,
      Curiosity: 0,
      Peace: 0
    };

    // History for debugging and visualization
    this.history = [];
    this.turnCount = 0;
  }

  /**
   * Activate dimensions based on detected relevance
   * @param {string[]} domains - Array of domain names to activate
   * @param {string[]} emotions - Array of emotion names to activate
   * @param {number} intensity - Optional intensity modifier (0-1)
   */
  activate(domains = [], emotions = [], intensity = 1.0) {
    this.turnCount++;
    
    const activations = {
      turn: this.turnCount,
      domains: [],
      emotions: [],
      timestamp: new Date().toISOString()
    };

    // Activate domains
    for (const domain of domains) {
      if (this.domainHeat.hasOwnProperty(domain)) {
        const previousHeat = this.domainHeat[domain];
        const increment = this.config.heatIncrement * intensity;
        
        if (previousHeat === 0) {
          // First activation - start at initial heat
          this.domainHeat[domain] = this.config.initialHeat * intensity;
        } else {
          // Subsequent activation - add heat
          this.domainHeat[domain] = Math.min(
            this.config.maxHeat,
            previousHeat + increment
          );
        }
        
        activations.domains.push({
          name: domain,
          previous: previousHeat,
          current: this.domainHeat[domain]
        });
      }
    }

    // Activate emotions
    for (const emotion of emotions) {
      if (this.emotionHeat.hasOwnProperty(emotion)) {
        const previousHeat = this.emotionHeat[emotion];
        const increment = this.config.heatIncrement * intensity;
        
        if (previousHeat === 0) {
          this.emotionHeat[emotion] = this.config.initialHeat * intensity;
        } else {
          this.emotionHeat[emotion] = Math.min(
            this.config.maxHeat,
            previousHeat + increment
          );
        }
        
        activations.emotions.push({
          name: emotion,
          previous: previousHeat,
          current: this.emotionHeat[emotion]
        });
      }
    }

    // Decay non-activated dimensions
    this._decayInactive(domains, emotions);

    // Record history
    this.history.push(activations);

    return this.getState();
  }

  /**
   * Decay dimensions that weren't activated this turn
   * Warm dimensions (>30% heat) decay at half rate to preserve momentum
   */
  _decayInactive(activatedDomains, activatedEmotions) {
    // Decay domains
    for (const domain of Object.keys(this.domainHeat)) {
      if (!activatedDomains.includes(domain) && this.domainHeat[domain] > 0) {
        // Warm dimensions decay at half rate
        const decayRate = this.domainHeat[domain] >= this.config.warmThreshold
          ? this.config.heatDecay * 0.5
          : this.config.heatDecay;
        this.domainHeat[domain] = Math.max(
          this.config.minHeat,
          this.domainHeat[domain] - decayRate
        );
      }
    }

    // Decay emotions
    for (const emotion of Object.keys(this.emotionHeat)) {
      if (!activatedEmotions.includes(emotion) && this.emotionHeat[emotion] > 0) {
        // Warm emotions decay at half rate
        const decayRate = this.emotionHeat[emotion] >= this.config.warmThreshold
          ? this.config.heatDecay * 0.5
          : this.config.heatDecay;
        this.emotionHeat[emotion] = Math.max(
          this.config.minHeat,
          this.emotionHeat[emotion] - decayRate
        );
      }
    }
  }

  /**
   * Get current heat state with categorization
   */
  getState() {
    const categorize = (heat) => {
      if (heat >= this.config.hotThreshold) return 'hot';
      if (heat >= this.config.warmThreshold) return 'warm';
      if (heat >= this.config.coldThreshold) return 'cool';
      return 'cold';
    };

    const domainState = {};
    for (const [domain, heat] of Object.entries(this.domainHeat)) {
      domainState[domain] = {
        heat: Math.round(heat * 100) / 100,
        status: categorize(heat)
      };
    }

    const emotionState = {};
    for (const [emotion, heat] of Object.entries(this.emotionHeat)) {
      emotionState[emotion] = {
        heat: Math.round(heat * 100) / 100,
        status: categorize(heat)
      };
    }

    return {
      turn: this.turnCount,
      domains: domainState,
      emotions: emotionState
    };
  }

  /**
   * Get dimensions above a certain heat level
   */
  getActive(minHeat = 0.1) {
    const activeDomains = Object.entries(this.domainHeat)
      .filter(([_, heat]) => heat >= minHeat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, heat]) => ({ name, heat }));

    const activeEmotions = Object.entries(this.emotionHeat)
      .filter(([_, heat]) => heat >= minHeat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, heat]) => ({ name, heat }));

    return { domains: activeDomains, emotions: activeEmotions };
  }

  /**
   * Get the "hottest" dimensions for retrieval prioritization
   */
  getHottest(topN = 3) {
    const allDimensions = [
      ...Object.entries(this.domainHeat).map(([name, heat]) => ({ 
        name, heat, type: 'domain' 
      })),
      ...Object.entries(this.emotionHeat).map(([name, heat]) => ({ 
        name, heat, type: 'emotion' 
      }))
    ];

    return allDimensions
      .filter(d => d.heat > 0)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, topN);
  }

  /**
   * Calculate retrieval depth based on heat level
   * Higher heat = deeper retrieval (older memories, more foundational)
   */
  getRetrievalDepth(dimensionName) {
    const heat = this.domainHeat[dimensionName] ?? this.emotionHeat[dimensionName] ?? 0;
    
    // Map heat to depth levels
    if (heat >= this.config.hotThreshold) {
      return { level: 'deep', maxAge: null, limit: 10 };      // All memories
    } else if (heat >= this.config.warmThreshold) {
      return { level: 'medium', maxAge: 90, limit: 5 };       // Last 90 days
    } else if (heat >= this.config.coldThreshold) {
      return { level: 'shallow', maxAge: 30, limit: 3 };      // Last 30 days
    } else {
      return { level: 'none', maxAge: 0, limit: 0 };          // No retrieval
    }
  }

  /**
   * Reset all heat (new conversation)
   */
  reset() {
    for (const domain of Object.keys(this.domainHeat)) {
      this.domainHeat[domain] = 0;
    }
    for (const emotion of Object.keys(this.emotionHeat)) {
      this.emotionHeat[emotion] = 0;
    }
    this.history = [];
    this.turnCount = 0;
  }

  /**
   * Get a visual representation of current heat (for debugging)
   */
  visualize() {
    const bar = (heat) => {
      const filled = Math.round(heat * 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    let output = '\n=== HEARTH HEAT MAP ===\n\n';
    
    output += 'DOMAINS:\n';
    for (const [domain, heat] of Object.entries(this.domainHeat)) {
      output += `  ${domain.padEnd(15)} ${bar(heat)} ${(heat * 100).toFixed(0)}%\n`;
    }
    
    output += '\nEMOTIONS:\n';
    for (const [emotion, heat] of Object.entries(this.emotionHeat)) {
      output += `  ${emotion.padEnd(15)} ${bar(heat)} ${(heat * 100).toFixed(0)}%\n`;
    }
    
    output += '\n========================\n';
    
    return output;
  }

  /**
   * Export state for persistence
   */
  export() {
    return {
      config: this.config,
      domainHeat: { ...this.domainHeat },
      emotionHeat: { ...this.emotionHeat },
      history: [...this.history],
      turnCount: this.turnCount
    };
  }

  /**
   * Import state from persistence
   */
  import(state) {
    if (state.config) this.config = { ...this.config, ...state.config };
    if (state.domainHeat) this.domainHeat = { ...state.domainHeat };
    if (state.emotionHeat) this.emotionHeat = { ...state.emotionHeat };
    if (state.history) this.history = [...state.history];
    if (state.turnCount) this.turnCount = state.turnCount;
  }
}

export default HeatTracker;
