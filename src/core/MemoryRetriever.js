/**
 * MemoryRetriever - Retrieves relevant memories based on heat state
 * 
 * Uses the heat tracker to determine:
 * - Which dimensions to retrieve from
 * - How deep to go (recent vs. foundational memories)
 * - How many memories to pull
 */

import memoriesData from '../../memories.json' assert { type: 'json' };

export class MemoryRetriever {
  constructor(heatTracker, config = {}) {
    this.heatTracker = heatTracker;
    this.memories = memoriesData.memories;

    this.config = {
      maxTotalMemories: 10,       // Max memories to inject
      minHeatForRetrieval: 0.1,   // Minimum heat to trigger retrieval
      intensityWeight: 0.3,       // How much memory intensity affects ranking
      heatWeight: 0.7,            // How much dimension heat affects ranking
      ...config
    };
  }

  /**
   * Main retrieval method - gets memories based on current heat state
   */
  retrieve() {
    const activeState = this.heatTracker.getActive(this.config.minHeatForRetrieval);

    // Even with no active dimensions, return high-intensity foundational memories
    if (activeState.domains.length === 0 && activeState.emotions.length === 0) {
      const fallbackMemories = this._getFallbackMemories(2);
      const context = this._buildContext(fallbackMemories, activeState);
      return {
        memories: fallbackMemories,
        context,
        meta: { reason: 'fallback_no_dimensions', memoriesRetrieved: fallbackMemories.length }
      };
    }

    // Score each memory based on heat alignment
    const scoredMemories = this.memories.map(memory => {
      const score = this._scoreMemory(memory, activeState);
      return { ...memory, _score: score };
    });

    // Filter and sort by score
    let relevantMemories = scoredMemories
      .filter(m => m._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, this.config.maxTotalMemories);

    // If we got nothing from scoring, provide fallback memories
    if (relevantMemories.length === 0) {
      relevantMemories = this._getFallbackMemories(3);
    }
    // If we got fewer than minimum, supplement with fallbacks
    else if (relevantMemories.length < 2) {
      const fallbacks = this._getFallbackMemories(2 - relevantMemories.length);
      const existingIds = new Set(relevantMemories.map(m => m.id));
      for (const fb of fallbacks) {
        if (!existingIds.has(fb.id)) {
          relevantMemories.push(fb);
        }
      }
    }

    // Update access metadata (in a real system, this would persist)
    for (const memory of relevantMemories) {
      memory.last_accessed = new Date().toISOString();
      memory.access_count = (memory.access_count || 0) + 1;
    }

    // Build context string for injection
    const context = this._buildContext(relevantMemories, activeState);

    return {
      memories: relevantMemories,
      context,
      meta: {
        activeDomains: activeState.domains,
        activeEmotions: activeState.emotions,
        memoriesRetrieved: relevantMemories.length
      }
    };
  }

  /**
   * Get fallback memories when normal retrieval returns nothing
   * Returns high-intensity, foundational memories
   */
  _getFallbackMemories(count = 2) {
    return this.memories
      .filter(m => (m.intensity || 0) >= 0.8)
      .sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      .slice(0, count);
  }

  /**
   * Score a memory based on how well it matches active dimensions
   */
  _scoreMemory(memory, activeState) {
    let score = 0;

    // Score based on domain overlap
    for (const domain of memory.domains || []) {
      const activeDomain = activeState.domains.find(d => d.name === domain);
      if (activeDomain) {
        score += activeDomain.heat * this.config.heatWeight;
      }
    }

    // Score based on emotion overlap
    for (const emotion of memory.emotions || []) {
      const activeEmotion = activeState.emotions.find(e => e.name === emotion);
      if (activeEmotion) {
        score += activeEmotion.heat * this.config.heatWeight;
      }
    }

    // Boost by memory intensity
    score += (memory.intensity || 0.5) * this.config.intensityWeight;

    // Apply depth filtering based on heat
    const depth = this._getDepthForMemory(memory, activeState);
    if (!depth.allowed) {
      return 0; // Memory is too deep for current heat level
    }

    return score;
  }

  /**
   * Determine if a memory is within retrieval depth based on heat
   */
  _getDepthForMemory(memory, activeState) {
    // Get the highest heat among matching dimensions
    let maxHeat = 0;

    for (const domain of memory.domains || []) {
      const match = activeState.domains.find(d => d.name === domain);
      if (match) maxHeat = Math.max(maxHeat, match.heat);
    }

    for (const emotion of memory.emotions || []) {
      const match = activeState.emotions.find(e => e.name === emotion);
      if (match) maxHeat = Math.max(maxHeat, match.heat);
    }

    // Determine allowed age based on heat
    const memoryAge = this._getMemoryAgeInDays(memory);

    if (maxHeat >= 0.6) {
      // High Heat (>60%): Full access - foundational memories, deep history
      return { allowed: true, reason: 'hot' };
    } else if (maxHeat >= 0.3) {
      // Medium Heat (30-60%): Retrieve more memories, including older ones (last 90 days)
      return { allowed: memoryAge <= 90, reason: 'warm' };
    } else if (maxHeat > 0) {
      // Low Heat (0-30%): Only retrieve recent, surface-level memories (last 30 days)
      return { allowed: memoryAge <= 30, reason: 'cool' };
    }

    return { allowed: false, reason: 'none' };
  }

  /**
   * Calculate memory age in days
   */
  _getMemoryAgeInDays(memory) {
    if (!memory.created) return 0;
    const created = new Date(memory.created);
    const now = new Date();
    const diffMs = now - created;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Build context string for injection into AI prompt
   */
  _buildContext(memories, activeState) {
    if (memories.length === 0) {
      return '';
    }

    // Build a natural-language context block
    let context = '<relevant_context>\n';
    context += 'The following memories are relevant to this conversation:\n\n';

    // Group by primary theme
    const byDomain = {};
    for (const memory of memories) {
      const primaryDomain = memory.domains?.[0] || 'General';
      if (!byDomain[primaryDomain]) {
        byDomain[primaryDomain] = [];
      }
      byDomain[primaryDomain].push(memory);
    }

    for (const [domain, domainMemories] of Object.entries(byDomain)) {
      context += `[${domain}]\n`;
      for (const memory of domainMemories) {
        context += `- ${memory.content}\n`;
      }
      context += '\n';
    }

    // Add active dimension context
    const hotDomains = activeState.domains
      .filter(d => d.heat >= 0.7)
      .map(d => d.name);
    const hotEmotions = activeState.emotions
      .filter(e => e.heat >= 0.7)
      .map(e => e.name);

    if (hotDomains.length > 0 || hotEmotions.length > 0) {
      context += 'This conversation is particularly focused on: ';
      const focuses = [...hotDomains, ...hotEmotions];
      context += focuses.join(', ') + '.\n';
    }

    context += '</relevant_context>';

    return context;
  }

  /**
   * Get memories for a specific dimension (for debugging/visualization)
   */
  getMemoriesForDimension(dimensionName, limit = 5) {
    return this.memories
      .filter(m =>
        (m.domains || []).includes(dimensionName) ||
        (m.emotions || []).includes(dimensionName)
      )
      .sort((a, b) => (b.intensity || 0) - (a.intensity || 0))
      .slice(0, limit);
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const domainCounts = {};
    const emotionCounts = {};

    for (const memory of this.memories) {
      for (const domain of memory.domains || []) {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
      for (const emotion of memory.emotions || []) {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      }
    }

    return {
      totalMemories: this.memories.length,
      byDomain: domainCounts,
      byEmotion: emotionCounts,
      averageIntensity: this.memories.reduce((sum, m) => sum + (m.intensity || 0), 0) / this.memories.length
    };
  }
}

export default MemoryRetriever;
