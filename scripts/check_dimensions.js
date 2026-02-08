
const https = require('https');

const SUPABASE_URL = 'https://wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

function fetchMemories() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'wkfwtivvhwyjlkyrikeu.supabase.co',
            path: '/rest/v1/memories?select=id,life_domain,emotional_state',
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function check() {
    try {
        console.log('Fetching memories...');
        const memories = await fetchMemories();

        if (!Array.isArray(memories)) {
            console.error('Failed to fetch memories:', memories);
            return;
        }

        const total = memories.length;
        const withDomain = memories.filter(m => m.life_domain).length;
        const withEmotion = memories.filter(m => m.emotional_state).length;
        const fullyBackfilled = memories.filter(m => m.life_domain && m.emotional_state).length;

        console.log('\n--- Dimension Status ---');
        console.log(`Total Memories: ${total}`);
        console.log(`With Life Domain: ${withDomain} (${((withDomain / total) * 100).toFixed(1)}%)`);
        console.log(`With Emotional State: ${withEmotion} (${((withEmotion / total) * 100).toFixed(1)}%)`);
        console.log(`Fully Dimensioned: ${fullyBackfilled} (${((fullyBackfilled / total) * 100).toFixed(1)}%)`);

        if (fullyBackfilled === total) {
            console.log('\n✅ All memories are backfilled.');
        } else {
            console.log(`\n⚠️ Missing dimensions for ${total - fullyBackfilled} memories.`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

check();
