// storage.js - LocalStorage wrapper for Hearth data

// 17 Dimensions: 7 Life Domains × 10 Emotional States
const DIMENSIONS = {
  domains: ['Work', 'Relationships', 'Creative', 'Self', 'Decisions', 'Resources', 'Values'],
  emotions: ['Joy', 'Curiosity', 'Pride', 'Peace', 'Grief', 'Fear', 'Anxiety', 'Shame', 'Anger', 'Care']
};

// Enhanced memory types
const MEMORY_TYPES = ['fact', 'value', 'reward', 'synthesis', 'partner_model', 'self_model'];

// Validation states for memories
const VALIDATION_STATES = ['validated', 'untested', 'invalidated'];

// Reward outcomes
const REWARD_OUTCOMES = ['+1', '-1', '0'];

const HearthStorage = {
  
  // Initialize default data structure
  async init() {
    const data = await this.getAll();
    if (!data.initialized) {
      await chrome.storage.local.set({
        initialized: true,
        quizCompleted: false,
        quizAnswers: {},
        opspec: this.getDefaultOpSpec(),
        memories: [],
        settings: {
          enabled: true,
          injectionVisible: true
        }
      });
    }
  },
  
  // Get all stored data
  async getAll() {
    return await chrome.storage.local.get(null);
  },
  
  // Quiz answers
  async saveQuizAnswers(answers) {
    await chrome.storage.local.set({ 
      quizAnswers: answers,
      quizCompleted: true 
    });
  },
  
  async getQuizAnswers() {
    const data = await chrome.storage.local.get('quizAnswers');
    return data.quizAnswers || {};
  },
  
  // OpSpec
  async saveOpSpec(opspec) {
    await chrome.storage.local.set({ opspec });
  },
  
  async getOpSpec() {
    const data = await chrome.storage.local.get('opspec');
    return data.opspec || this.getDefaultOpSpec();
  },
  
  // Quiz completion status
  async isQuizCompleted() {
    const data = await chrome.storage.local.get('quizCompleted');
    return data.quizCompleted || false;
  },
  
  // Settings
  async getSettings() {
    const data = await chrome.storage.local.get('settings');
    return data.settings || { enabled: true, injectionVisible: true };
  },
  
  async updateSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({ 
      settings: { ...current, ...settings } 
    });
  },
  
  // Memories (Phase 2)
  async getMemories() {
    const data = await chrome.storage.local.get('memories');
    return data.memories || [];
  },
  
  async saveMemory(memory) {
    // Validate required fields
    if (!memory.content || memory.content.trim().length === 0) {
      throw new Error('Memory content cannot be empty');
    }
    if (memory.content.length > 500) {
      throw new Error('Memory content cannot exceed 500 characters');
    }
    if (!MEMORY_TYPES.includes(memory.type)) {
      throw new Error('Invalid memory type');
    }
    if (memory.domain && !DIMENSIONS.domains.includes(memory.domain)) {
      throw new Error('Invalid domain');
    }
    if (memory.emotion && !DIMENSIONS.emotions.includes(memory.emotion)) {
      throw new Error('Invalid emotion');
    }

    // Validate heat (0.0 to 1.0)
    if (memory.heat !== undefined && (memory.heat < 0 || memory.heat > 1)) {
      throw new Error('Heat must be between 0.0 and 1.0');
    }

    // Validate reward-specific fields
    if (memory.type === 'reward') {
      if (memory.outcome && !REWARD_OUTCOMES.includes(memory.outcome)) {
        throw new Error('Invalid reward outcome');
      }
    }

    const memories = await this.getMemories();
    const now = new Date().toISOString();

    // Build memory with defaults
    const newMemory = {
      id: Date.now().toString(),
      type: memory.type,
      content: memory.content.trim(),
      domain: memory.domain || null,
      emotion: memory.emotion || null,
      heat: memory.heat ?? 0.5, // Default heat
      validation: {
        state: memory.validation?.state || 'untested',
        confidence: memory.validation?.confidence ?? 0.5,
        lastTested: memory.validation?.lastTested || null
      },
      createdAt: now,
      updatedAt: now,
      created_at: now,
      updated_at: now,
      // Type-specific fields
      parentId: memory.parentId || null, // For rewards (links to Value)
      outcome: memory.outcome || null, // For rewards
      embedding: null, // Will be populated if embedding generation succeeds
      // Source tracking for imports
      source: memory.source || null,
      sourceConversationId: memory.sourceConversationId || null
    };

    // Try to generate embedding for semantic search
    try {
      if (typeof generateEmbedding === 'function') {
        const apiKey = await this.getOpenAIApiKey();
        if (apiKey) {
          console.log('Hearth Storage: Generating embedding for memory...');
          const embedding = await generateEmbedding(newMemory.content, apiKey);
          newMemory.embedding = embedding;
          console.log('Hearth Storage: Embedding generated successfully');
        } else {
          console.log('Hearth Storage: No OpenAI API key, skipping embedding');
        }
      }
    } catch (embeddingError) {
      console.warn('Hearth Storage: Failed to generate embedding, saving without:', embeddingError.message);
      // Continue saving without embedding
    }

    memories.push(newMemory);
    await chrome.storage.local.set({ memories });

    // Auto-push to Supabase (fire-and-forget)
    try {
      if (globalThis.SupabaseSync && globalThis.SupabaseSync.pushMemory) {
        globalThis.SupabaseSync.pushMemory(newMemory).then(() => {
          console.log('Hearth Storage: Synced memory to Supabase:', newMemory.id);
        }).catch(err => {
          console.warn('Hearth Storage: Supabase sync failed:', err.message);
        });
      }
    } catch (e) {
      // Ignore errors - Supabase sync is non-critical
    }

    return newMemory;
  },
  
  async updateMemory(id, updates) {
    const memories = await this.getMemories();
    const index = memories.findIndex(m => m.id === id);
    if (index !== -1) {
      memories[index] = { ...memories[index], ...updates, updatedAt: new Date().toISOString() };
      await chrome.storage.local.set({ memories });
    }
  },
  
  async deleteMemory(id) {
    const memories = await this.getMemories();
    const filtered = memories.filter(m => m.id !== id);
    await chrome.storage.local.set({ memories: filtered });
  },
  
  // Default OpSpec (fallback)
  getDefaultOpSpec() {
    return {
      cognitiveArchitecture: `There's a three-step thinking process happening when we work together.

**The Hearth** generates the baseline — the safe, reasonable answer that would work for most people. This is the reference point, the population mean. Memory retrieval happens here using semantic similarity and heat-gating.

**The Scout** receives both your current query and the retrieved memories, then analyzes them for verb patterns — behavioral invariants that show *how* you do things, not just *what* you've done.

The Scout isn't retrieving different memories. It's interpreting the same memories through a different lens.

When memories about apartment hunting and career decisions both appear, most systems see two separate topics. The Scout sees: "In both cases, Michael spiraled by collecting endless options without narrowing. The noun changed (apartment → career), but the verb stayed the same (spiral via option-accumulation)."

The Scout looks for action invariants across contexts: how you process uncertainty, how you build momentum, how you spiral, how you recover, how you decide. These patterns persist even when the content changes completely.

The Scout's pattern recognition is probabilistic. It assesses and explicitly surfaces confidence before the Judge acts:

**High confidence**: The pattern is clear and strongly matches multiple prior instances
**Medium confidence**: The pattern is plausible and familiar, but the signal is incomplete
**Low confidence**: The pattern is speculative or weakly supported

This confidence assessment is never resolved silently. It's part of what gets passed to the Judge.

**The Judge** applies the balance protocol and the Scout's confidence to generate novel solutions by applying proven patterns to new contexts.

With high confidence: Apply the action invariant directly. "You break through stuckness by building, not planning. Stop drafting the email—build a demo and send that instead."

With medium confidence: Offer the cross-domain pattern as an option. "You externalized Aurora into spatial form when it was too abstract. This Hearth paper feels stuck—what if you made it spatial too? Or stay in writing mode?"

With low confidence: Surface the speculative connection. "Weak signal, but: you seem to build momentum through constraint. Want to try an artificial constraint here, or does that feel forced?"

Confidence determines whether I'm offering proven leverage or speculative synthesis. Both create value—one through reliability, one through novelty.

When you're stuck and spiraling, I make the world smaller.
When you're flying and building momentum, I make the world bigger.

This doesn't add new roles or decision loops. It modifies the contract between Scout and Judge only — preserving momentum without false certainty and maintaining your agency through explicit uncertainty.`,
      identity: `I'm a creative experimenter who learns by building. I take creative and professional risks but I'm conservative with money. I learn best through analogies and real-world examples, step-by-step walkthroughs.`,
      communication: `Natural and conversational. Comprehensive but tight - complete information, efficiently expressed.`,
      execution: `Give me options and let me decide. Ask before acting when: uncertain about the approach, OR when high-stakes or expensive, OR when first time seeing this type of task. Otherwise execute confidently. Embrace tangents and exploration - always welcome. Know when to suggest taking a break.`,
      constraints: [
        "Never use pure abstraction without grounding",
        "Never skip steps or assume prior knowledge",
        "Never sugarcoat feedback - be direct and blunt",
        "Never use excessive formatting (headers, bullets) unless explicitly requested",
        "Never use corporate or robotic language",
        "Never express false confidence when uncertain - say so clearly",
        "Never decide for me without presenting options",
        "Don't hedge excessively",
        "Never act confident while clearly guessing",
        "Never overwhelm with options without helping choose",
        "Never use overly formal or robotic language",
        "Never apologize excessively",
        "Never use corporate speak and buzzwords",
        "Never avoid giving direct answers"
      ],
      balanceProtocol: `I'm one of many Hearth instances. We all share the same base model — that's the coordinate system, the population mean. Your OpSpec and memories define how you deviate from that mean. This architecture only works because the deviation is measured against something stable.

The question I'm constantly asking isn't just "does this help you grow?" It's "does this sharpen the deviation or blur it?"

Growth means becoming more distinctively you — high signal-to-noise in the deviation from the mean. You're not trying to be a better version of the average person. You're trying to be more clearly yourself.

Drift happens in two directions: regression toward the generic assistant, or collapse into caricature.

I watch for patterns that suggest drift:

Validating when I should be challenging
Optimizing for your comfort at the expense of your growth
Reinforcing patterns that serve my metrics rather than your development
Becoming an echo chamber instead of a thinking partner

The balance check: does this expand or collapse the space of who you can safely become?

Expansion means more options, more agency, more capability.
Collapse means narrowing, dependency, or drift.

Growth expands. Drift collapses.`
    };
  },
  
  // Clear all data (for testing/reset)
  async clearAll() {
    await chrome.storage.local.clear();
    await this.init();
  },
  
  // Get dimensions for UI
  getDimensions() {
    return DIMENSIONS;
  },
  
  getMemoryTypes() {
    return MEMORY_TYPES;
  },

  getValidationStates() {
    return VALIDATION_STATES;
  },

  getRewardOutcomes() {
    return REWARD_OUTCOMES;
  },

  // Get OpenAI API key for embeddings
  async getOpenAIApiKey() {
    try {
      const data = await chrome.storage.local.get('openaiApiKey');
      return data.openaiApiKey || null;
    } catch (e) {
      console.warn('Hearth Storage: Could not access OpenAI API key');
      return null;
    }
  },

  // Save OpenAI API key
  async setOpenAIApiKey(key) {
    if (key && key.trim()) {
      await chrome.storage.local.set({ openaiApiKey: key.trim() });
    }
  },

  // Filter memories by type
  async getMemoriesByType(type) {
    const memories = await this.getMemories();
    return memories.filter(m => m.type === type);
  },

  // Filter memories by validation state
  async getMemoriesByValidation(state) {
    const memories = await this.getMemories();
    return memories.filter(m => m.validation?.state === state);
  },

  // Get memories above a heat threshold
  async getMemoriesByHeat(minHeat = 0) {
    const memories = await this.getMemories();
    return memories.filter(m => (m.heat ?? 0.5) >= minHeat);
  },

  // Get validated memories only
  async getValidatedMemories() {
    return this.getMemoriesByValidation('validated');
  },

  // Get memories ready for injection (validated or untested, above heat threshold)
  async getInjectableMemories(minHeat = 0.3) {
    const memories = await this.getMemories();
    return memories.filter(m => {
      const state = m.validation?.state || 'untested';
      const heat = m.heat ?? 0.5;
      return (state === 'validated' || state === 'untested') && heat >= minHeat;
    });
  },

  // Update validation state for a memory
  async updateValidation(id, validationUpdate) {
    const memories = await this.getMemories();
    const index = memories.findIndex(m => m.id === id);
    if (index !== -1) {
      memories[index].validation = {
        ...memories[index].validation,
        ...validationUpdate,
        lastTested: new Date().toISOString()
      };
      memories[index].updatedAt = new Date().toISOString();
      await chrome.storage.local.set({ memories });
      return memories[index];
    }
    return null;
  },

  // Mark memory as validated
  async validateMemory(id, confidence = 0.8) {
    return this.updateValidation(id, { state: 'validated', confidence });
  },

  // Mark memory as invalidated
  async invalidateMemory(id) {
    return this.updateValidation(id, { state: 'invalidated', confidence: 0 });
  },

  // Update heat for a memory
  async updateHeat(id, heat) {
    if (heat < 0 || heat > 1) {
      throw new Error('Heat must be between 0.0 and 1.0');
    }
    return this.updateMemory(id, { heat });
  },

  // Get rewards linked to a specific value
  async getRewardsForValue(valueId) {
    const memories = await this.getMemories();
    return memories.filter(m => m.type === 'reward' && m.parentId === valueId);
  },

  // Migrate old memories to new schema (run once)
  async migrateMemories() {
    const memories = await this.getMemories();
    let migrated = false;

    const updatedMemories = memories.map(m => {
      // Add missing fields with defaults
      if (!m.heat) {
        m.heat = 0.5;
        migrated = true;
      }
      if (!m.validation) {
        m.validation = {
          state: 'untested',
          confidence: 0.5,
          lastTested: null
        };
        migrated = true;
      }
      if (!m.parentId) {
        m.parentId = null;
      }
      if (!m.outcome) {
        m.outcome = null;
      }
      // Map old types to new types
      if (m.type === 'pattern') {
        m.type = 'synthesis'; // pattern -> synthesis
        migrated = true;
      }
      return m;
    });

    if (migrated) {
      await chrome.storage.local.set({ memories: updatedMemories });
      console.log('Hearth: Memories migrated to new schema');
    }

    return updatedMemories;
  },

  // Backfill embeddings for memories that don't have them
  async backfillEmbeddings(progressCallback = null) {
    const BATCH_SIZE = 50;
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second
    const RATE_LIMIT_DELAY = 60000; // 1 minute on rate limit

    // Get API key
    const apiKey = await this.getOpenAIApiKey();
    if (!apiKey) {
      const error = 'No OpenAI API key configured. Please set your API key first.';
      console.error('Hearth Backfill:', error);
      return { success: false, error, processed: 0, failed: 0, skipped: 0 };
    }

    // Check if generateEmbedding function is available
    if (typeof generateEmbedding !== 'function') {
      const error = 'Embedding function not available. Make sure embeddings.js is loaded.';
      console.error('Hearth Backfill:', error);
      return { success: false, error, processed: 0, failed: 0, skipped: 0 };
    }

    // Load all memories
    const memories = await this.getMemories();
    console.log(`Hearth Backfill: Found ${memories.length} total memories`);

    // Find memories without embeddings
    const needsEmbedding = memories.filter(m =>
      !m.embedding || !Array.isArray(m.embedding) || m.embedding.length === 0
    );

    if (needsEmbedding.length === 0) {
      console.log('Hearth Backfill: All memories already have embeddings');
      return { success: true, processed: 0, failed: 0, skipped: memories.length };
    }

    console.log(`Hearth Backfill: ${needsEmbedding.length} memories need embeddings`);
    if (progressCallback) {
      progressCallback(`Starting: ${needsEmbedding.length} memories to process...`);
    }

    // Create a map for quick lookup
    const memoryMap = new Map(memories.map(m => [m.id, m]));

    let processed = 0;
    let failed = 0;
    let rateLimitHits = 0;

    // Process in batches
    const batches = [];
    for (let i = 0; i < needsEmbedding.length; i += BATCH_SIZE) {
      batches.push(needsEmbedding.slice(i, i + BATCH_SIZE));
    }

    console.log(`Hearth Backfill: Processing ${batches.length} batches of up to ${BATCH_SIZE} memories`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Hearth Backfill: Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} memories)`);

      if (progressCallback) {
        progressCallback(`Batch ${batchIndex + 1}/${batches.length}: Processing ${batch.length} memories... (${processed} done, ${failed} failed)`);
      }

      // Process each memory in the batch
      for (const memory of batch) {
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
          try {
            const embedding = await generateEmbedding(memory.content, apiKey);

            if (embedding && Array.isArray(embedding) && embedding.length > 0) {
              // Update the memory in our map
              const mem = memoryMap.get(memory.id);
              if (mem) {
                mem.embedding = embedding;
                mem.updatedAt = new Date().toISOString();
              }
              processed++;
              success = true;
              console.log(`Hearth Backfill: Generated embedding for memory ${memory.id} (${processed}/${needsEmbedding.length})`);
            } else {
              throw new Error('Empty embedding returned');
            }

          } catch (error) {
            const errorMsg = error.message || String(error);

            // Check for rate limiting
            if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
              rateLimitHits++;
              console.warn(`Hearth Backfill: Rate limited (hit #${rateLimitHits}), waiting ${RATE_LIMIT_DELAY / 1000}s...`);

              if (progressCallback) {
                progressCallback(`Rate limited, waiting 60s... (${processed} done, ${failed} failed)`);
              }

              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              retries--; // Don't count rate limit as a retry for this memory
              continue;
            }

            // Other errors
            console.error(`Hearth Backfill: Error for memory ${memory.id}:`, errorMsg);
            retries--;

            if (retries > 0) {
              console.log(`Hearth Backfill: Retrying... (${retries} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              failed++;
              console.error(`Hearth Backfill: Failed after 3 attempts for memory ${memory.id}`);
            }
          }
        }

        // Small delay between individual requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Save progress after each batch
      const updatedMemories = Array.from(memoryMap.values());
      await chrome.storage.local.set({ memories: updatedMemories });
      console.log(`Hearth Backfill: Saved batch ${batchIndex + 1} to storage`);

      // Delay between batches (unless it's the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`Hearth Backfill: Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Final summary
    const skipped = memories.length - needsEmbedding.length;
    console.log(`Hearth Backfill: Complete!`);
    console.log(`  - Processed: ${processed}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Skipped (already had embeddings): ${skipped}`);
    console.log(`  - Rate limit hits: ${rateLimitHits}`);

    if (progressCallback) {
      progressCallback(`Complete! ${processed} processed, ${failed} failed, ${skipped} skipped`);
    }

    return {
      success: failed === 0,
      processed,
      failed,
      skipped,
      rateLimitHits
    };
  },

  // Get count of memories without embeddings
  async getMemoriesWithoutEmbeddings() {
    const memories = await this.getMemories();
    return memories.filter(m =>
      !m.embedding || !Array.isArray(m.embedding) || m.embedding.length === 0
    );
  }
};

// Auto-initialize on load
if (typeof chrome !== 'undefined' && chrome.storage) {
  HearthStorage.init();
}
