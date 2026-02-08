#!/usr/bin/env node

/**
 * Memory Curation Script
 *
 * Fetches all memories from Supabase, sends each to Haiku for
 * KEEP / REMOVE / CONSOLIDATE classification, and writes a
 * curation report. Does NOT delete anything — dry run only.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/curateMemories.js
 */

const SUPABASE_URL = 'https://wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY env var is required');
  process.exit(1);
}

const SYSTEM_PROMPT = `You are curating memories for a personalized AI system. The user values connecting verbs (behavioral patterns, decision-making styles) over connecting nouns (topics, facts). Rate this memory:

KEEP - Durable understanding about how this person thinks, decides, or works. Patterns that would change AI behavior.
REMOVE - Stale implementation details, test data, ephemeral debug moments, or trivially obvious facts.
CONSOLIDATE - Duplicate or near-duplicate of common themes (flag the theme).

Respond with exactly one word: KEEP, REMOVE, or CONSOLIDATE. Then a pipe character. Then a one-sentence reason.`;

const RATE_LIMIT_MS = 100; // 10 req/sec

// ============================================================
// Supabase: fetch all memories
// ============================================================

async function fetchAllMemories() {
  const memories = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/memories?select=id,content,type,memory_type,domain,emotion,validation_state,durability,created_at&order=created_at.asc&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      console.error('Supabase fetch failed:', res.status, await res.text());
      break;
    }

    const batch = await res.json();
    memories.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return memories;
}

// ============================================================
// Anthropic: classify a single memory
// ============================================================

async function classifyMemory(content) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Parse "KEEP|reason" or "REMOVE|reason" or "CONSOLIDATE|reason"
  const pipeIdx = text.indexOf('|');
  if (pipeIdx === -1) {
    return { verdict: text.trim().toUpperCase(), reason: '' };
  }

  const verdict = text.substring(0, pipeIdx).trim().toUpperCase();
  const reason = text.substring(pipeIdx + 1).trim();
  return { verdict, reason };
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('Fetching all memories from Supabase...');
  const memories = await fetchAllMemories();
  console.log(`Fetched ${memories.length} memories\n`);

  const report = { keep: [], remove: [], consolidate: [], errors: [] };
  let processed = 0;

  for (const memory of memories) {
    processed++;
    const preview = (memory.content || '').substring(0, 60).replace(/\n/g, ' ');

    try {
      const { verdict, reason } = await classifyMemory(memory.content || '');

      const entry = {
        id: memory.id,
        content: memory.content,
        type: memory.type,
        memory_type: memory.memory_type,
        domain: memory.domain,
        created_at: memory.created_at,
        verdict,
        reason,
      };

      if (verdict === 'KEEP') {
        report.keep.push(entry);
      } else if (verdict === 'REMOVE') {
        report.remove.push(entry);
      } else if (verdict === 'CONSOLIDATE') {
        report.consolidate.push(entry);
      } else {
        entry.rawVerdict = verdict;
        report.errors.push(entry);
      }

      const symbol = verdict === 'KEEP' ? '+' : verdict === 'REMOVE' ? '-' : '~';
      process.stdout.write(`\r[${processed}/${memories.length}] ${symbol} ${preview}`);
    } catch (err) {
      report.errors.push({
        id: memory.id,
        content: memory.content,
        error: err.message,
      });
      process.stdout.write(`\r[${processed}/${memories.length}] ! ERROR: ${err.message.substring(0, 50)}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  // Clear progress line
  process.stdout.write('\n\n');

  // Write report
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, 'curation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Summary
  console.log('=== Curation Summary ===');
  console.log(`KEEP:         ${report.keep.length}`);
  console.log(`REMOVE:       ${report.remove.length}`);
  console.log(`CONSOLIDATE:  ${report.consolidate.length}`);
  console.log(`ERRORS:       ${report.errors.length}`);
  console.log(`TOTAL:        ${memories.length}`);
  console.log(`\nReport saved to: ${reportPath}`);
  console.log('This is a DRY RUN — no memories were deleted.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
