/**
 * Hearth - The main orchestrator for dimensional memory retrieval
 * 
 * Ties together:
 * - DimensionDetector: Figures out what dimensions a prompt activates
 * - HeatTracker: Tracks which dimensions are hot across the conversation
 * - MemoryRetriever: Pulls relevant memories based on heat state
 * 
 * Usage:
 *   const hearth = new Hearth();
 *   const { context, heatMap } = await hearth.process(userPrompt);
 *   // Inject context into AI prompt
 */

import { HeatTracker } from './HeatTracker.js';
import { DimensionDetector } from './DimensionDetector.js';
import { MemoryRetriever } from './MemoryRetriever.js';

export class Hearth {
  constructor(config = {}) {
    this.config = {
      useAIDetection: false,  // Use AI for dimension detection (slower, more accurate)
      debug: false,           // Log debug information
      ...config
    };

    // Initialize components
    this.heatTracker = new HeatTracker(config.heatConfig);
    this.detector = new DimensionDetector(config.detectorConfig);
    this.retriever = new MemoryRetriever(this.heatTracker, config.retrieverConfig);

    // Optional: Anthropic client for AI-powered detection
    this.anthropicClient = config.anthropicClient || null;

    // Conversation history for context
    this.conversationHistory = [];

    // Initialize heat tracker with existing memories
    this.initializeFromMemories();
  }

  /**
   * Initialize heat tracker from existing memories
   * This "primes" the heat map with the user's memory profile
   */
  initializeFromMemories() {
    const memories = this.retriever.memories;

    if (!memories || memories.length === 0) {
      return;
    }

    // Activate heat for each memory's dimensions
    for (const memory of memories) {
      if (memory.domains && memory.emotions) {
        this.heatTracker.activate(
          memory.domains,
          memory.emotions,
          memory.intensity || 0.5
        );
      }
    }

    if (this.config.debug) {
      console.log(`[Hearth] Initialized with ${memories.length} memories`);
      console.log(this.heatTracker.visualize());
    }
  }

  /**
   * Main processing method - takes a user prompt and returns enriched context
   */
  async process(userPrompt) {
    // Step 1: Detect which dimensions this prompt activates
    let detection;
    if (this.config.useAIDetection && this.anthropicClient) {
      detection = await this.detector.detectWithAI(userPrompt, this.anthropicClient);
    } else {
      detection = this.detector.detect(userPrompt);
    }

    if (this.config.debug) {
      console.log('\n[Hearth] Dimension Detection:', detection);
    }

    // Step 2: Update heat tracker with detected dimensions
    const activatedDomains = detection.domains.map(d => d.name);
    const activatedEmotions = detection.emotions.map(e => e.name);

    // Calculate average intensity from detection scores
    const avgIntensity = [
      ...detection.domains.map(d => d.score),
      ...detection.emotions.map(e => e.score)
    ].reduce((sum, s) => sum + s, 0) /
      Math.max(detection.domains.length + detection.emotions.length, 1);

    this.heatTracker.activate(activatedDomains, activatedEmotions, avgIntensity);

    if (this.config.debug) {
      console.log(this.heatTracker.visualize());
    }

    // Step 3: Retrieve relevant memories based on heat state
    const retrieval = this.retriever.retrieve();

    if (this.config.debug) {
      console.log('[Hearth] Retrieved memories:', retrieval.memories.length);
    }

    // Step 4: Build the enriched prompt
    const enrichedContext = this._buildEnrichedContext(userPrompt, retrieval);

    // Track conversation turn
    this.conversationHistory.push({
      prompt: userPrompt,
      detection,
      heatState: this.heatTracker.getState(),
      memoriesRetrieved: retrieval.memories.length,
      timestamp: new Date().toISOString()
    });

    return {
      originalPrompt: userPrompt,
      context: retrieval.context,
      enrichedPrompt: enrichedContext,
      heatMap: this.heatTracker.getState(),
      detection,
      memories: retrieval.memories,
      meta: {
        turn: this.heatTracker.turnCount,
        detectionMethod: detection.method,
        memoriesRetrieved: retrieval.memories.length,
        hottestDimensions: this.heatTracker.getHottest(3)
      }
    };
  }

  /**
   * Build the enriched context to inject before the user's prompt
   */
  _buildEnrichedContext(userPrompt, retrieval) {
    if (!retrieval.context) {
      return userPrompt;
    }

    return `${retrieval.context}\n\n---\n\nUser message: ${userPrompt}`;
  }

  /**
   * Get a summary of the current conversation's heat patterns
   */
  getConversationSummary() {
    const state = this.heatTracker.getState();

    // Find what ran hot
    const hotDomains = Object.entries(state.domains)
      .filter(([_, data]) => data.status === 'hot')
      .map(([name, _]) => name);

    const hotEmotions = Object.entries(state.emotions)
      .filter(([_, data]) => data.status === 'hot')
      .map(([name, _]) => name);

    // Find what was touched but cooled
    const touchedDomains = Object.entries(state.domains)
      .filter(([_, data]) => data.heat > 0 && data.status !== 'hot')
      .map(([name, _]) => name);

    const touchedEmotions = Object.entries(state.emotions)
      .filter(([_, data]) => data.heat > 0 && data.status !== 'hot')
      .map(([name, _]) => name);

    return {
      turns: this.heatTracker.turnCount,
      hotDomains,
      hotEmotions,
      touchedDomains,
      touchedEmotions,
      summary: this._generateNaturalSummary(hotDomains, hotEmotions, touchedDomains, touchedEmotions)
    };
  }

  /**
   * Generate a natural language summary of the conversation
   */
  _generateNaturalSummary(hotDomains, hotEmotions, touchedDomains, touchedEmotions) {
    let summary = 'This conversation ';

    if (hotDomains.length > 0 || hotEmotions.length > 0) {
      summary += 'was primarily about ';
      const hot = [...hotDomains, ...hotEmotions];
      summary += hot.join(' and ');
      summary += '. ';
    }

    if (touchedDomains.length > 0 || touchedEmotions.length > 0) {
      summary += 'It also touched on ';
      const touched = [...touchedDomains, ...touchedEmotions];
      summary += touched.join(', ');
      summary += '.';
    }

    if (hotDomains.length === 0 && hotEmotions.length === 0 &&
      touchedDomains.length === 0 && touchedEmotions.length === 0) {
      summary = 'This conversation has just started.';
    }

    return summary;
  }

  /**
   * Reset for a new conversation
   */
  reset() {
    this.heatTracker.reset();
    this.conversationHistory = [];
  }

  /**
   * Export conversation state for persistence
   */
  exportState() {
    return {
      heatState: this.heatTracker.export(),
      conversationHistory: this.conversationHistory,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import conversation state
   */
  importState(state) {
    if (state.heatState) {
      this.heatTracker.import(state.heatState);
    }
    if (state.conversationHistory) {
      this.conversationHistory = state.conversationHistory;
    }
  }

  /**
   * Get the visual heat map (for debugging/UI)
   */
  visualize() {
    return this.heatTracker.visualize();
  }
}

export default Hearth;
