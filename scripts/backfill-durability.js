/**
 * One-time migration: backfill durability field for all existing memories.
 *
 * Usage: node hearth/scripts/backfill-durability.js
 *        (run from project root)
 *
 * Prerequisites: the 'durability' column must exist on the memories table.
 * If it doesn't, the script will print the SQL to run first.
 */

const https = require('https');
const path = require('path');
const { classifyDurability } = require(path.resolve(__dirname, '../utils/durabilityClassifier'));

const SUPABASE_HOSTNAME = 'wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

// --- API CLIENT (matches existing backfill pattern) ---

function supabaseRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
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

async function fetchAllMemories() {
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
  return supabaseRequest(options);
}

async function updateDurability(id, durability) {
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
  return supabaseRequest(options, JSON.stringify({ durability }));
}

/**
 * Probe whether the durability column exists by PATCHing a dummy filter
 * that matches no rows. If the column doesn't exist, Supabase returns 400.
 */
async function probeDurabilityColumn() {
  const options = {
    hostname: SUPABASE_HOSTNAME,
    path: '/rest/v1/memories?id=eq.00000000-0000-0000-0000-000000000000',
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  };
  try {
    await supabaseRequest(options, JSON.stringify({ durability: 'contextual' }));
    return true; // column exists (PATCH succeeded, matched 0 rows)
  } catch (e) {
    if (e.message.includes('durability') || e.message.includes('42703')) {
      return false; // column does not exist
    }
    throw e; // some other error
  }
}

const MIGRATION_SQL = `
-- Run this in the Supabase SQL Editor first:
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS durability TEXT DEFAULT 'contextual'
  CHECK (durability IN ('ephemeral', 'contextual', 'durable'));
`.trim();

// --- MAIN ---

async function run() {
  console.log('Durability backfill starting...\n');

  // Step 1: check column exists
  console.log('Checking for durability column...');
  const columnExists = await probeDurabilityColumn();
  if (!columnExists) {
    console.error('\nThe "durability" column does not exist on the memories table.');
    console.error('Run this SQL in the Supabase SQL Editor first:\n');
    console.error(MIGRATION_SQL);
    console.error('\nThen re-run this script.');
    process.exit(1);
  }
  console.log('Column exists.\n');

  // Step 2: fetch all memories
  const memories = await fetchAllMemories();
  if (!Array.isArray(memories)) {
    console.error('Failed to fetch memories from Supabase');
    process.exit(1);
  }

  if (memories.length === 0) {
    console.log('No memories found. Nothing to do.');
    return;
  }

  console.log(`Fetched ${memories.length} memories\n`);

  const counts = { ephemeral: 0, contextual: 0, durable: 0 };
  let updated = 0;
  let errors = 0;

  const BATCH_SIZE = 5;
  for (let i = 0; i < memories.length; i += BATCH_SIZE) {
    const batch = memories.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (m) => {
      const durability = classifyDurability(m.content);
      counts[durability]++;

      try {
        await updateDurability(m.id, durability);
        updated++;
      } catch (e) {
        console.error(`  Failed ${m.id.substring(0, 8)}: ${e.message}`);
        errors++;
      }
    }));

    // Progress every 50
    if ((i + BATCH_SIZE) % 50 < BATCH_SIZE) {
      console.log(`  ${Math.min(i + BATCH_SIZE, memories.length)}/${memories.length} processed...`);
    }
  }

  // --- Summary ---
  console.log('\n--- Durability Backfill Complete ---');
  console.log(`Total memories:  ${memories.length}`);
  console.log(`Updated:         ${updated}`);
  console.log(`Errors:          ${errors}`);
  console.log('');
  console.log('Distribution:');
  console.log(`  ephemeral:   ${counts.ephemeral}  (${pct(counts.ephemeral, memories.length)})`);
  console.log(`  contextual:  ${counts.contextual}  (${pct(counts.contextual, memories.length)})`);
  console.log(`  durable:     ${counts.durable}  (${pct(counts.durable, memories.length)})`);

  // Skew warning
  const max = Math.max(counts.ephemeral, counts.contextual, counts.durable);
  if (max / memories.length >= 0.9) {
    const dominant = Object.entries(counts).find(([, v]) => v === max)[0];
    console.log(`\n** WARNING: ${pct(max, memories.length)} classified as '${dominant}' — classifier patterns likely need tuning **`);
  }
}

function pct(n, total) {
  return (n / total * 100).toFixed(1) + '%';
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
