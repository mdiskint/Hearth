const https = require('https');

const SUPABASE_HOSTNAME = 'wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

// --- CLASSIFIERS (Copied from supabase.js) ---

function classifyLifeDomain(content) {
    const text = (content || '').toLowerCase();
    const domainKeywords = {
        work: ['job', 'career', 'work', 'office', 'colleague', 'boss', 'project', 'deadline', 'meeting', 'salary', 'promotion'],
        relationships: ['friend', 'family', 'partner', 'wife', 'husband', 'parent', 'child', 'dating', 'relationship', 'social'],
        creative: ['write', 'create', 'art', 'music', 'design', 'story', 'creative', 'idea', 'imagination', 'build'],
        self: ['feel', 'think', 'believe', 'identity', 'personality', 'habit', 'routine', 'health', 'mental', 'growth'],
        decisions: ['decide', 'choice', 'option', 'should', 'whether', 'pros', 'cons', 'tradeoff', 'commit', 'change'],
        resources: ['money', 'time', 'budget', 'save', 'spend', 'invest', 'cost', 'afford', 'resource', 'manage'],
        values: ['believe', 'value', 'important', 'principle', 'ethics', 'meaning', 'purpose', 'integrity', 'priority', 'matter']
    };

    let bestMatch = null;
    let bestCount = 0;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
        const count = keywords.filter(k => text.includes(k)).length;
        if (count > bestCount) {
            bestCount = count;
            bestMatch = domain;
        }
    }
    return bestMatch;
}

function classifyEmotionalState(content) {
    const text = (content || '').toLowerCase();
    const emotionKeywords = {
        joy: ['happy', 'excited', 'thrilled', 'delighted', 'joy', 'wonderful', 'amazing', 'love', 'celebrate'],
        curiosity: ['curious', 'wonder', 'explore', 'learn', 'discover', 'interesting', 'fascinated', 'question'],
        pride: ['proud', 'accomplished', 'achieved', 'succeeded', 'mastered', 'confident', 'capable'],
        peace: ['calm', 'peaceful', 'content', 'relaxed', 'serene', 'balanced', 'accepting', 'settled'],
        grief: ['loss', 'grief', 'mourning', 'miss', 'gone', 'died', 'passed', 'goodbye'],
        fear: ['afraid', 'scared', 'terrified', 'fear', 'dread', 'worried', 'panic'],
        anxiety: ['anxious', 'nervous', 'worried', 'stress', 'overwhelmed', 'uncertain', 'uneasy'],
        shame: ['shame', 'embarrassed', 'guilty', 'regret', 'stupid', 'failure', 'worthless'],
        anger: ['angry', 'frustrated', 'furious', 'annoyed', 'irritated', 'resentful', 'mad'],
        care: ['care', 'concern', 'help', 'support', 'protect', 'nurture', 'compassion', 'empathy']
    };

    let bestMatch = null;
    let bestCount = 0;

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        const count = keywords.filter(k => text.includes(k)).length;
        if (count > bestCount) {
            bestCount = count;
            bestMatch = emotion;
        }
    }
    return bestMatch;
}

// --- API CLIENT ---

function fetchRequests(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        // PATCH returns no content sometimes or representation
                        // If empty string, return null
                        resolve(data ? JSON.parse(data) : null);
                    } catch (e) { resolve(null); }
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function fetchMemories() {
    const options = {
        hostname: SUPABASE_HOSTNAME,
        path: '/rest/v1/memories?select=id,content&limit=1000',
        method: 'GET',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    return fetchRequests(options);
}

async function updateMemory(id, payload) {
    const options = {
        hostname: SUPABASE_HOSTNAME,
        path: `/rest/v1/memories?id=eq.${id}`,
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
    };
    return fetchRequests(options, JSON.stringify(payload));
}

// --- MAIN ---

async function run() {
    console.log('Starting backfill...');
    try {
        const memories = await fetchMemories();
        if (!Array.isArray(memories)) {
            console.error('Failed to fetch memories');
            return;
        }
        console.log(`Analyzing ${memories.length} memories...`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        // Simple semaphore for concurrency
        const BATCH_SIZE = 5;
        for (let i = 0; i < memories.length; i += BATCH_SIZE) {
            const batch = memories.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (m) => {
                const domain = classifyLifeDomain(m.content);
                const emotion = classifyEmotionalState(m.content);

                if (domain || emotion) {
                    const payload = {};
                    if (domain) payload.life_domain = domain;
                    if (emotion) payload.emotional_state = emotion;

                    try {
                        await updateMemory(m.id, payload);
                        updated++;
                    } catch (e) {
                        console.error(`Failed to update ${m.id}: ${e.message}`);
                        errors++;
                    }
                } else {
                    skipped++;
                }
            }));

            if (i % 50 === 0) {
                console.log(`Processed ${Math.min(i + BATCH_SIZE, memories.length)}/${memories.length} (Updated: ${updated})`);
            }
        }

        console.log(`\n\n--- Backfill Complete ---`);
        console.log(`Total: ${memories.length}`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped (no match): ${skipped}`);
        console.log(`Errors: ${errors}`);

    } catch (err) {
        console.error('Fatal error:', err);
    }
}

run();
