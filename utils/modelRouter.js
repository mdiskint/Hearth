// Model router - intelligent API model selection based on conversation complexity

const MODEL_COSTS = {
  'claude-haiku-4-20250514': {
    input: 0.25,   // per million tokens
    output: 1.25,
    name: 'Haiku 4'
  },
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
    name: 'Sonnet 4'
  },
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
    name: 'Opus 4'
  }
};

class ModelRouter {
  constructor() {
    this.stats = {
      totalCalls: 0,
      totalCost: 0,
      byModel: {}
    };
    // In-memory only - no chrome.storage in page context
  }

  saveStats() {
    // Stats kept in memory, reset on page reload
    // Future: message to content script for persistence
  }

  // Analyze conversation complexity
  analyzeComplexity(messages) {
    let score = 0;

    // Count indicators of complexity
    const allText = messages.map(m => m.content).join(' ');
    const words = allText.split(/\s+/).length;

    // Length complexity (more words = potentially deeper)
    if (words > 500) score += 3;
    else if (words > 200) score += 2;
    else if (words > 100) score += 1;

    // Vocabulary complexity (longer average word length)
    const avgWordLength = allText.replace(/\s/g, '').length / words;
    if (avgWordLength > 6) score += 2;
    else if (avgWordLength > 5) score += 1;

    // Topic indicators
    const deepTopics = [
      'philosophy', 'phenomenology', 'consciousness', 'epistemology',
      'constitutional', 'theoretical', 'framework', 'paradigm',
      'synthesis', 'ontology', 'metaphor', 'analogy', 'tension'
    ];

    // Simple technical = Haiku territory
    const simpleTechnical = [
      'bug', 'error', 'fix', 'broken', "doesn't work", "not working",
      'how do i', 'tooltip', 'button', 'click', 'install'
    ];

    // Complex technical = Sonnet/Opus territory
    const complexTechnical = [
      'architecture', 'design pattern', 'trade-off', 'refactor',
      'optimize', 'scale', 'performance', 'security', 'should we',
      'approach', 'strategy', 'infrastructure', 'migration',
      'integration', 'abstraction', 'coupling', 'cohesion'
    ];

    const deepMatches = deepTopics.filter(t =>
      allText.toLowerCase().includes(t)
    ).length;

    const simpleTechMatches = simpleTechnical.filter(t =>
      allText.toLowerCase().includes(t)
    ).length;

    const complexTechMatches = complexTechnical.filter(t =>
      allText.toLowerCase().includes(t)
    ).length;

    // Deep philosophical = highest complexity (tiered for intensity)
    if (deepMatches >= 5) score += 5;      // Very dense philosophical
    else if (deepMatches >= 3) score += 3; // Standard deep discussion
    else if (deepMatches >= 2) score += 2;
    else if (deepMatches >= 1) score += 1;

    // Complex technical = medium-high complexity
    if (complexTechMatches >= 3) score += 3;
    else if (complexTechMatches >= 2) score += 2;
    else if (complexTechMatches >= 1) score += 1;

    // Simple technical = keep score low (Haiku appropriate)
    // No points added - these stay in Haiku range

    // Question complexity
    const questions = (allText.match(/\?/g) || []).length;
    if (questions >= 3) score += 2;
    else if (questions >= 2) score += 1;

    // Multi-turn depth
    if (messages.length >= 8) score += 2;
    else if (messages.length >= 6) score += 1;

    return score;
  }

  // Select model based on complexity score
  selectModel(complexityScore) {
    if (complexityScore >= 8) {
      return 'claude-opus-4-20250514';  // Deep philosophical/complex
    } else if (complexityScore >= 4) {
      return 'claude-sonnet-4-20250514'; // Standard conversations
    } else {
      return 'claude-haiku-4-20250514';  // Simple/technical
    }
  }

  // Estimate and track costs
  trackUsage(model, inputTokens, outputTokens) {
    const costs = MODEL_COSTS[model];
    const cost = (
      (inputTokens / 1000000) * costs.input +
      (outputTokens / 1000000) * costs.output
    );

    this.stats.totalCalls++;
    this.stats.totalCost += cost;

    if (!this.stats.byModel[model]) {
      this.stats.byModel[model] = {
        calls: 0,
        cost: 0,
        name: costs.name
      };
    }

    this.stats.byModel[model].calls++;
    this.stats.byModel[model].cost += cost;

    this.saveStats();

    return cost;
  }

  // Get routing decision with explanation
  getRoutingDecision(messages) {
    const score = this.analyzeComplexity(messages);
    const model = this.selectModel(score);
    const modelName = MODEL_COSTS[model].name;

    return {
      model,
      modelName,
      complexityScore: score,
      reasoning: this.explainScore(score)
    };
  }

  explainScore(score) {
    if (score >= 8) return 'Complex/philosophical - needs nuanced understanding';
    if (score >= 4) return 'Standard conversation - balanced capability';
    return 'Simple/technical - straightforward extraction';
  }

  getStats() {
    return {
      ...this.stats,
      formattedCost: `$${this.stats.totalCost.toFixed(4)}`
    };
  }

  resetStats() {
    this.stats = {
      totalCalls: 0,
      totalCost: 0,
      byModel: {}
    };
    this.saveStats();
  }
}

// Export for both contexts
if (typeof window !== 'undefined') {
  window.ModelRouter = new ModelRouter();
} else {
  self.ModelRouter = new ModelRouter();
}
