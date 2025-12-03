/**
 * MemoryRetriever - Retrieves relevant memories based on heat state
 * 
 * Uses the heat tracker to determine:
 * - Which dimensions to retrieve from
 * - How deep to go (recent vs. foundational memories)
 * - How many memories to pull
 */

export class MemoryRetriever {
    constructor(memories = [], config = {}) {
        this.memories = memories;

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
     * @param {Object} activeDimensions - { domains: [], emotions: [] } detected in current message
     * @param {Object} heatState - { domains: {Name: {heat: 0.5}}, emotions: ... } from HeatTracker
     */
    retrieve(activeDimensions, heatState) {
        // We need to convert heatState (which has all dimensions) into a list of active dimensions with heat
        // similar to what heatTracker.getActive() returned.

        const getActiveFromState = (stateObj) => {
            return Object.entries(stateObj)
                .filter(([_, val]) => (val.heat || val) >= this.config.minHeatForRetrieval)
                .map(([name, val]) => ({ name, heat: val.heat || val }));
        };

        const activeDomains = getActiveFromState(heatState.domains || {});
        const activeEmotions = getActiveFromState(heatState.emotions || {});

        const activeState = { domains: activeDomains, emotions: activeEmotions };

        // Even with no active dimensions, return high-intensity foundational memories
        if (activeState.domains.length === 0 && activeState.emotions.length === 0) {
            const fallbackMemories = this._getFallbackMemories(2);
            // We don't need to build context string here, the injector does it.
            // But let's return it just in case or keep the API consistent.
            // The injector expects just the array of memories.
            return {
                memories: fallbackMemories,
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
            const existingIds = new Set(relevantMemories.map(m => m.id || m.content)); // Use content as ID fallback
            for (const fb of fallbacks) {
                if (!existingIds.has(fb.id || fb.content)) {
                    relevantMemories.push(fb);
                }
            }
        }

        return {
            memories: relevantMemories,
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
}
