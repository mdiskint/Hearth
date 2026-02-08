/**
 * forgeDetector.test.js — Run with: node forgeDetector.test.js
 * Validates phase detection across scenarios.
 */

const {
  detect,
  reset,
  scorePhases,
  detectPhase,
  questionToCommandRatio,
  lexicalVariety,
  ideaDensity,
  reframingFrequency,
  concreteness,
  PHASE_PATTERNS,
  PHASE_INSTRUCTIONS,
  FUSION_RULES
} = require('./forgeDetector.js');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// Helper to simulate conversation flow
function simulateConversation(messages) {
  reset();
  let result;
  for (const msg of messages) {
    result = detect(msg, null);
  }
  return result;
}

// ─── DIVERGE SCENARIOS ─────────────────────────────────────

test('Pure diverge: multiple hypotheticals', () => {
  const result = simulateConversation([
    "What if we used a sliding window? Or maybe a decay function?",
    "Another option — what about event-driven? Or polling with backoff?",
    "Could also try a hybrid... what would happen if we combined them?"
  ]);
  assert(result.openness > 0.4, `openness should be > 0.4, got ${result.openness}`);
  assert(result.phase === 'DIVERGING' || result.phase.includes('DIVERG'), `phase should be DIVERGING, got ${result.phase}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

test('Diverge: rapid-fire short ideas', () => {
  const result = simulateConversation([
    "what about websockets?",
    "or SSE maybe?",
    "long polling could work too",
    "or just a simple timer with exponential backoff?",
    "hmm what if we don't poll at all?"
  ]);
  assert(result.openness > 0.3, `openness should be > 0.3, got ${result.openness}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

// ─── INCUBATE SCENARIOS ────────────────────────────────────

test('Incubate: circling, vague, reaching', () => {
  const result = simulateConversation([
    "There's something about this that I can't quite put my finger on...",
    "I keep coming back to the idea but I don't know what it means yet",
    "It feels like there's a connection between these things... something about the pattern"
  ]);
  assert(result.materiality < 0.5, `materiality should be < 0.5, got ${result.materiality}`);
  assert(result.phase === 'INCUBATING' || result.phase === 'NEUTRAL', `phase should be INCUBATING or NEUTRAL, got ${result.phase}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

test('Incubate: stuck and self-referential', () => {
  const result = simulateConversation([
    "I'm stuck on this and I can't quite figure it out",
    "I sense it's related to what we discussed earlier... hard to articulate",
    "Something about the way it all connects... hmm"
  ]);
  assert(result.materiality < 0.6, `materiality should be < 0.6, got ${result.materiality}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

// ─── CONVERGE SCENARIOS ────────────────────────────────────

test('Converge: decisive, building', () => {
  const result = simulateConversation([
    "I've decided on a two-axis system",
    "The first axis is openness, specifically how many possibilities are active",
    "Let's build it. The detector needs to run on the last 5 messages",
    "Implement the scoring function first, then wire it in"
  ]);
  assert(result.openness < 0.5, `openness should be < 0.5, got ${result.openness}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

test('Converge: sequential logic, commitment', () => {
  const result = simulateConversation([
    "The key is to make the transitions invisible",
    "Specifically, the complement text must blend, not switch",
    "Let's go with continuous values instead of discrete modes",
    "Build this as two continuous axes with regions, not categories"
  ]);
  assert(result.openness < 0.6, `openness should be < 0.6, got ${result.openness}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

// ─── REFINE SCENARIOS ──────────────────────────────────────

test('Refine: editing existing artifact', () => {
  const result = simulateConversation([
    "Looking at this code — the scoring function needs to be tighter",
    "Tweak the openness score, it's weighting questions too heavily",
    "Adjust the phrase matching to be stronger, fix the trajectory dampening",
    "Clean up version 2 of the detector.js file"
  ]);
  assert(result.materiality > 0.4, `materiality should be > 0.4, got ${result.materiality}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

test('Refine: reviewing and reflecting', () => {
  const result = simulateConversation([
    "Here's what we built: a two-axis detector with continuous scoring in detector.js",
    "This version is 100% better than the manual toggle",
    "Polish the cross-modulation between affect and forge",
    "Iterate on version 3, tighten the scoring"
  ]);
  assert(result.materiality > 0.3, `materiality should be > 0.3, got ${result.materiality}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

// ─── COMPLEMENT TEXT VALIDATION ────────────────────────────

test('Complement text: has proper structure', () => {
  const result = simulateConversation([
    "What if we tried this? Or that? Maybe something else?",
    "Could also go a completely different direction",
    "What about combining approaches?"
  ]);
  assert(result.block.includes('[FORGE COMPLEMENT]'), 'Should have forge complement opening tag');
  assert(result.block.includes('[END FORGE COMPLEMENT]'), 'Should have forge complement closing tag');
  assert(result.block.includes('openness='), 'Should include openness value');
  assert(result.block.includes('materiality='), 'Should include materiality value');
  assert(result.block.includes('Phase:'), 'Should include phase label');
  console.log(`  → Block length: ${result.block.length} chars`);
});

test('Neutral: no strong signals', () => {
  const result = simulateConversation([
    "Sounds good",
    "Thanks, that makes sense",
    "Got it"
  ]);
  assert(result.phase === 'NEUTRAL', `phase should be NEUTRAL, got ${result.phase}`);
  console.log(`  → openness=${result.openness}, materiality=${result.materiality}, phase=${result.phase}`);
});

// ─── FUSION WITH AFFECT ────────────────────────────────────

test('Fusion: DIVERGING + contracted affect', () => {
  reset();
  const result = detect(
    "What if we tried something new? Or maybe another approach? What about exploring alternatives?",
    { expansion: -0.3, activation: 0, certainty: 0 }
  );
  // Should include affect fusion instruction
  assert(result.block.includes('Lower stakes') || result.block.includes('contracted'),
    'Should include contracted affect fusion for DIVERGING');
  console.log(`  → Phase: ${result.phase}, has fusion: ${result.block.includes('Affect fusion')}`);
});

test('Fusion: DIVERGING + flooding affect', () => {
  reset();
  const result = detect(
    "What if we do this OR that OR something else?! So many possibilities!!",
    { expansion: 0, activation: 0.5, certainty: 0 }
  );
  // Should include flooding fusion when phase is DIVERGING
  if (result.phase === 'DIVERGING') {
    assert(result.block.includes('threads') || result.block.includes('flooding'),
      'Should include flooding affect fusion for DIVERGING');
  }
  console.log(`  → Phase: ${result.phase}, has fusion: ${result.block.includes('Affect fusion')}`);
});

test('Fusion: INCUBATING + frozen affect', () => {
  reset();
  detect("I keep thinking about this thing...", null);
  detect("Something about it... I can't quite say...", null);
  const result = detect(
    "I'm stuck. Hard to explain. Let me sit with it.",
    { expansion: 0, activation: -0.3, certainty: 0 }
  );
  if (result.phase === 'INCUBATING') {
    assert(result.block.includes('warm') || result.block.includes('frozen'),
      'Should include frozen affect fusion for INCUBATING');
  }
  console.log(`  → Phase: ${result.phase}, has fusion: ${result.block.includes('Affect fusion')}`);
});

// ─── STRUCTURAL SIGNAL TESTS ───────────────────────────────

test('questionToCommandRatio: question-heavy is positive', () => {
  const ratio = questionToCommandRatio("what if we tried this? or maybe that? what would happen?");
  assert(ratio > 0, `Should be positive, got ${ratio}`);
  console.log(`  → ratio: ${ratio}`);
});

test('questionToCommandRatio: command-heavy is negative', () => {
  const ratio = questionToCommandRatio("build the function. create the file. run the tests.");
  assert(ratio < 0, `Should be negative, got ${ratio}`);
  console.log(`  → ratio: ${ratio}`);
});

test('lexicalVariety: high variety for exploring text', () => {
  const variety = lexicalVariety("we could explore different options using various approaches across multiple domains");
  assert(variety > 0.6, `Should be > 0.6, got ${variety}`);
  console.log(`  → variety: ${variety}`);
});

test('lexicalVariety: low variety for repetitive text', () => {
  const variety = lexicalVariety("the thing the thing the thing the thing the thing");
  assert(variety < 0.3, `Should be < 0.3, got ${variety}`);
  console.log(`  → variety: ${variety}`);
});

test('ideaDensity: high density for branching text', () => {
  const density = ideaDensity("we could do X, or Y, but also Z; and maybe A because of B, so then C");
  assert(density > 2, `Should be > 2, got ${density}`);
  console.log(`  → density: ${density}`);
});

test('reframingFrequency: detects self-corrections', () => {
  const freq = reframingFrequency("wait actually no what I mean is... hold on, let me rephrase that");
  assert(freq >= 2, `Should detect at least 2 reframings, got ${freq}`);
  console.log(`  → frequency: ${freq}`);
});

test('concreteness: code/technical text is high', () => {
  const score = concreteness("function getData() { return fetch('api.js'); } const x = 42;");
  assert(score > 0.5, `Should be > 0.5, got ${score}`);
  console.log(`  → concreteness: ${score}`);
});

test('concreteness: vague text is low', () => {
  const score = concreteness("something about the feeling of the thing, maybe like the idea or concept");
  assert(score < 0.5, `Should be < 0.5, got ${score}`);
  console.log(`  → concreteness: ${score}`);
});

// ─── BUFFER TESTS ───────────────────────────────────────────

test('Buffer: reset clears history', () => {
  detect("First message", null);
  detect("Second message", null);
  reset();
  const result = detect("Fresh start after reset", null);
  // After reset, only one message in buffer
  assert(result.phase !== undefined, 'Should still detect phase after reset');
  console.log(`  → Phase after reset: ${result.phase}`);
});

test('Buffer: accumulates trajectory signal', () => {
  reset();
  // Start diverging
  detect("What if we tried this?", null);
  detect("Or maybe that?", null);
  const divergeResult = detect("What about another option?", null);

  // Then converge
  detect("Actually, let's go with option A", null);
  detect("Specifically, build it like this", null);
  const convergeResult = detect("Implement the solution now", null);

  // Openness should decrease from diverge to converge
  assert(convergeResult.openness < divergeResult.openness,
    `Openness should decrease during convergence: ${divergeResult.openness} -> ${convergeResult.openness}`);
  console.log(`  → Diverge openness: ${divergeResult.openness}, Converge openness: ${convergeResult.openness}`);
});

console.log('\n─── Done ───');
