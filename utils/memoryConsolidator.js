/**
 * Memory Consolidator - Conflict Resolution System
 * 
 * Identify and resolve conflicting memories to maintain a coherent knowledge base.
 */

const CONSOLIDATION_PROMPT = `
You are a Memory Consolidation Engine. Your goal is to resolve conflicts between a new memory and existing memories.

NEW MEMORY:
"{new_content}"

EXISTING MEMORIES:
{existing_list}

INSTRUCTIONS:
1. Determine if the NEW MEMORY contradicts or significantly updates any EXISTING MEMORIES (semantic conflict).
2. If there is a conflict/update, create a CONSOLIDATED VERSION that represents the current truth.
3. If the new memory is just a duplicate, mark it as such.
4. If there is no conflict, return null.

Return JSON:
{
  "has_conflict": boolean,
  "conflicting_ids": ["uuid1", "uuid2"],
  "resolution_type": "update" | "contradiction" | "duplicate" | "none",
  "consolidated_content": "The new detailed truth..." (or null if no conflict),
  "explanation": "Why this needs consolidation..."
}
`;

class MemoryConsolidator {
    constructor(supabaseClient, openaiKey) {
        this.supabase = supabaseClient;
        this.openaiKey = openaiKey;
    }

    /**
     * Check a memory for conflicts with existing knowledge
     * @param {Object} memory - The memory to check
     * @returns {Promise<Object>} Conflict analysis result
     */
    async checkConflicts(memory) {
        if (!this.openaiKey) return { has_conflict: false, error: 'No OpenAI key' };

        // 1. Find candidates (high similarity)
        const candidates = await this.supabase.searchMemoriesSemantic(memory.content, {
            matchThreshold: 0.8, // High threshold for potential duplicates/conflicts
            maxResults: 5,
            includeWithoutEmbedding: false
        });

        // Filter out the memory itself if it's already saved
        const others = candidates.filter(m => m.id !== memory.id);

        if (others.length === 0) {
            return { has_conflict: false, reason: 'No similar memories' };
        }

        // 2. Ask LLM to analyze
        return this.analyzeWithLLM(memory, others);
    }

    /**
     * Analyze potential conflicts using LLM
     */
    async analyzeWithLLM(newMemory, existingMemories) {
        try {
            const existingList = existingMemories
                .map(m => `- [${m.id}] ${m.content} (Source: ${m.source})`)
                .join('\n');

            const prompt = CONSOLIDATION_PROMPT
                .replace('{new_content}', newMemory.content)
                .replace('{existing_list}', existingList);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', // Fast, cheap model is sufficient
                    messages: [
                        { role: 'system', content: 'You are a precise knowledge base manager.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);

            return {
                ...result,
                original_id: newMemory.id,
                candidates: existingMemories
            };

        } catch (error) {
            console.error('Hearth: Consolidation analysis failed', error);
            return { has_conflict: false, error: error.message };
        }
    }

    /**
     * Apply a consolidation resolution
     * @param {Object} analysis - Result from checkConflicts
     */
    async applyResolution(analysis) {
        if (!analysis.has_conflict || !analysis.consolidated_content) return;

        // 1. Create the new consolidated memory
        const newMemory = {
            content: analysis.consolidated_content,
            source: `consolidation_${Date.now()}`,
            type: 'synthesis',
            memory_type: 'user', // Generally consolidated memories are user knowledge
            intensity: 0.8,      // High intensity for validated truth
            validation_state: 'consolidated',
            life_domain: 'values', // Default, should ideally classify
            emotional_state: 'peace',
            durability: 'durable' // Consolidated memories survived conflict resolution
        };

        const saved = await this.supabase.writeMemory(newMemory);

        if (saved) {
            // 2. Mark old memories as outdated
            const idsToRetire = [...analysis.conflicting_ids];
            if (analysis.original_id) idsToRetire.push(analysis.original_id);

            for (const id of idsToRetire) {
                await this.supabase.updateValidation(id, 'outdated');
            }

            console.log(`Hearth: Consolidated ${idsToRetire.length} memories into new ID ${saved.id}`);
            return saved;
        }
    }

    /**
     * Scan recent memories for conflicts and resolve them
     * @param {number} limit - How many recent memories to check
     * @param {function} onProgress - Callback for updates
     */
    async scanAndConsolidate(limit = 10, onProgress = () => { }) {
        if (!this.openaiKey) return { count: 0, error: 'No OpenAI key' };

        // Fetch recent memories
        const memories = await this.supabase.fetchMemories();
        const candidates = memories
            .filter(m => m.validation_state !== 'consolidated' && m.validation_state !== 'outdated')
            .slice(0, limit);

        let resolvedCount = 0;

        for (let i = 0; i < candidates.length; i++) {
            const memory = candidates[i];
            onProgress(`Checking ${i + 1}/${candidates.length}...`);

            const analysis = await this.checkConflicts(memory);

            if (analysis.has_conflict) {
                onProgress(`Found conflict in memory ${memory.id.substring(0, 6)}...`);
                const resolution = await this.applyResolution(analysis);
                if (resolution) resolvedCount++;
            }
        }

        onProgress(`Done. Resolved ${resolvedCount} conflicts.`);
        return resolvedCount;
    }
}

// Export for module/browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MemoryConsolidator };
}
if (typeof window !== 'undefined') {
    window.HearthMemoryConsolidator = MemoryConsolidator;
}
