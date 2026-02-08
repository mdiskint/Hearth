/**
 * Test script for Memory Consolidation
 * Verifies conflict detection and resolution logic.
 */

const { MemoryConsolidator } = require('../utils/memoryConsolidator.js');

// Mock Dependencies
const mockSupabase = {
    searchMemoriesSemantic: async () => [
        { id: '1', content: 'I hate spicy food.', source: 'test' },
        { id: '2', content: 'I love tacos.', source: 'test' }
    ],
    writeMemory: async (mem) => ({ id: 'new_consolidated_id', ...mem }),
    updateValidation: async (id, state) => console.log(`Supabase: Marked ${id} as ${state}`),
    fetchMemories: async () => [
        { id: 'new_provisional', content: 'I love spicy food now.', validation_state: 'provisional' }
    ]
};

// Mock Fetch for OpenAI
global.fetch = async (url, options) => {
    if (url.includes('api.openai.com')) {
        return {
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            has_conflict: true,
                            conflicting_ids: ['1'],
                            resolution_type: 'update',
                            consolidated_content: 'User used to hate spicy food but now loves it.',
                            explanation: 'Direct contradiction resolved by recency.'
                        })
                    }
                }]
            })
        };
    }
    return { ok: false };
};

async function testConsolidation() {
    console.log('--- Testing Memory Consolidation ---');

    const consolidator = new MemoryConsolidator(mockSupabase, 'sk-fake-key');

    // Test 1: Single Check
    console.log('\nTesting single memory check...');
    const result = await consolidator.checkConflicts({
        id: 'new_provisional',
        content: 'I love spicy food now.'
    });

    console.log('Analysis Result:', result);
    if (!result.has_conflict) throw new Error('Failed to detect conflict');
    if (result.conflicting_ids[0] !== '1') throw new Error('Identified wrong conflict ID');

    // Test 2: Apply Resolution
    console.log('\nTesting resolution application...');
    const resolution = await consolidator.applyResolution(result);
    if (!resolution || resolution.id !== 'new_consolidated_id') throw new Error('Failed to apply resolution');

    // Test 3: Batch Scan
    console.log('\nTesting batch scan...');
    const count = await consolidator.scanAndConsolidate(1, (msg) => console.log('Progress:', msg));
    console.log(`Resolved ${count} conflicts.`);
    if (count !== 1) throw new Error('Batch scan failed to resolve conflict');

    console.log('\n✅ Consolidation tests passed!');
}

testConsolidation().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
