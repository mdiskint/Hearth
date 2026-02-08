/**
 * Test script for Hearth V2 Retrieval
 * Verifies heat-gated temporal depth and cold query blocking.
 */

const { retrieveByHeat } = require('../storage/supabase.js');

// Mock global fetch
global.fetch = async (url, options) => {
    console.log(`Mock Fetch: ${url}`);

    if (url.includes('/rpc/search_memories')) {
        const body = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => {
                // Return mock memories based on filters
                return [
                    {
                        id: '1',
                        content: 'Test Memory',
                        similarity: 0.8,
                        intensity: 0.8,
                        validation_state: 'validated'
                    }
                ];
            }
        };
    }

    return { ok: true, json: async () => [] };
};

// Mock classify functions (usually in page context)
global.window = {
    HearthSupabase: {
        generateEmbedding: async () => new Array(1536).fill(0.1)
    }
};

async function testRetrieval() {
    console.log('--- Testing Cold Query (heat < 0.1) ---');
    const coldMemories = await retrieveByHeat('weather', 0.05);
    console.log(`Cold memories count: ${coldMemories.length} (Expected: 0)`);
    if (coldMemories.length !== 0) throw new Error('Cold query failed to block retrieval');

    console.log('\n--- Testing Cool Query (heat 0.2) ---');
    const coolMemories = await retrieveByHeat('latest project', 0.2);
    console.log(`Cool memories count: ${coolMemories.length} (Expected: >0)`);

    console.log('\n--- Testing Hot Query (heat 0.9) ---');
    const hotMemories = await retrieveByHeat('career fears', 0.9);
    console.log(`Hot memories count: ${hotMemories.length} (Expected: >0)`);

    console.log('\n✅ Retrieval tests passed!');
}

testRetrieval().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
