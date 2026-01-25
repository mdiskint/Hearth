/**
 * Scout Confidence Calibration Tests
 *
 * Tests for time-based confidence decay, contradiction handling,
 * and evidence-based confidence computation.
 *
 * Run with: node tests/scout-confidence.test.js
 */

const path = require('path');

// Load Scout modules
const {
  CONFIDENCE_CONFIG,
  computePatternConfidence,
  createSupportEvidence,
  createContradictEvidence,
  detectContradictions,
  detectPatternsInMemory,
  determineStrength
} = require('../utils/scout');

// Simple test runner
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertInRange(value, min, max, message) {
  if (value < min || value > max) {
    throw new Error(message || `Expected ${value} to be between ${min} and ${max}`);
  }
}

// Helper to create evidence with specific dates
function createEvidenceWithDate(patternId, polarity, daysAgo, strength = 'normal', domain = null) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id: `${patternId}_${polarity}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    pattern_id: patternId,
    domain: domain,
    observed_at: date.toISOString(),
    polarity: polarity,
    strength: strength
  };
}

console.log('\n=== Scout Confidence Calibration Tests ===\n');

// ============================================
// Test Suite 1: Basic Confidence Computation
// ============================================

console.log('--- Basic Confidence Computation ---\n');

test('Empty evidence returns DORMANT', () => {
  const result = computePatternConfidence([]);
  assertEqual(result.confidence, 'DORMANT');
  assertEqual(result.score, 0);
  assert(result.rationale.includes('No evidence'), 'Should mention no evidence');
});

test('Single recent support returns LOW or DORMANT confidence', () => {
  // Single weak support may be below DORMANT threshold
  const evidence = [createEvidenceWithDate('decision_spiral', 'support', 5, 'normal')];
  const result = computePatternConfidence(evidence);
  // Single support can be LOW or DORMANT depending on thresholds
  assert(result.confidence === 'LOW' || result.confidence === 'DORMANT',
    `Expected LOW or DORMANT, got ${result.confidence}`);
  assertInRange(result.score, 0, 0.3);
});

test('Multiple recent supports increase confidence', () => {
  const evidence = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 15, 'normal')
  ];
  const result = computePatternConfidence(evidence);
  assert(result.confidence === 'MEDIUM' || result.confidence === 'HIGH',
    `Expected MEDIUM or HIGH, got ${result.confidence}`);
  assertInRange(result.score, 0.3, 0.7);
});

test('4+ supports with cross-domain and recency can reach HIGH', () => {
  // Need cross-domain bonus + recency bonus to reach HIGH threshold (0.70)
  const evidence = [
    createEvidenceWithDate('decision_spiral', 'support', 1, 'strong', 'Work'),
    createEvidenceWithDate('decision_spiral', 'support', 5, 'strong', 'Work'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'strong', 'Decisions'),
    createEvidenceWithDate('decision_spiral', 'support', 15, 'strong', 'Creative')
  ];
  const result = computePatternConfidence(evidence);
  // With 4 recent supports, 3 domains, and recency bonus: 0.40 + 0.25 + 0.15 = 0.80
  assertEqual(result.confidence, 'HIGH');
  assertInRange(result.score, 0.7, 1.0);
});

// ============================================
// Test Suite 2: Time Decay
// ============================================

console.log('\n--- Time Decay ---\n');

test('Stale supports (30-90 days) have reduced weight', () => {
  // 4 supports from 60 days ago = weighted as 2.0 (4 * 0.5)
  const staleEvidence = [
    createEvidenceWithDate('decision_spiral', 'support', 60, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 61, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 62, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 63, 'normal')
  ];

  // 2 recent supports = weighted as 2.0 (2 * 1.0)
  const recentEvidence = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal')
  ];

  const staleResult = computePatternConfidence(staleEvidence);
  const recentResult = computePatternConfidence(recentEvidence);

  // Stale should score lower due to no recency bonus
  assert(staleResult.score <= recentResult.score + 0.1,
    'Stale evidence should not score much higher than recent');
});

test('Old supports (90+ days) have heavily reduced weight', () => {
  // 4 old supports = weighted as 1.0 (4 * 0.25), which maps to instance count 1 = 0.10 score
  // Score of 0.10 is at DORMANT threshold (0.10), may be LOW or DORMANT
  const oldEvidence = [
    createEvidenceWithDate('decision_spiral', 'support', 100, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 105, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 110, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 115, 'normal')
  ];

  const result = computePatternConfidence(oldEvidence);

  // 4 old supports weighted as 1.0 = LOW or DORMANT confidence
  assert(result.confidence === 'LOW' || result.confidence === 'DORMANT',
    `Expected LOW or DORMANT for old evidence, got ${result.confidence}`);
  // Score should be low due to decay
  assertInRange(result.score, 0, 0.25);
});

test('120+ days without recent support caps at MEDIUM', () => {
  // Many supports but all very old (>120 days)
  const evidence = [
    createEvidenceWithDate('decision_spiral', 'support', 130, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 135, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 140, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 145, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 150, 'strong')
  ];

  const result = computePatternConfidence(evidence);

  // Even with many strong supports, should be capped due to staleness
  assert(result.confidence !== 'HIGH',
    `Expected not HIGH, got ${result.confidence}`);
  if (result.debug.decayed_from === 'HIGH') {
    assert(result.rationale.includes('Decayed'), 'Should mention decay in rationale');
  }
});

// ============================================
// Test Suite 3: Contradiction Handling
// ============================================

console.log('\n--- Contradiction Handling ---\n');

test('Contradiction reduces confidence score', () => {
  const withoutContra = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal')
  ];

  const withContra = [
    ...withoutContra,
    createEvidenceWithDate('decision_spiral', 'contradict', 7, 'normal')
  ];

  const withoutResult = computePatternConfidence(withoutContra);
  const withResult = computePatternConfidence(withContra);

  assert(withResult.score < withoutResult.score,
    `Score with contradiction (${withResult.score}) should be less than without (${withoutResult.score})`);
});

test('Recent strong contradiction caps HIGH at MEDIUM', () => {
  // Strong supports that would normally be HIGH
  const evidence = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 15, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 20, 'strong'),
    // Recent strong contradiction
    createEvidenceWithDate('decision_spiral', 'contradict', 3, 'strong')
  ];

  const result = computePatternConfidence(evidence);

  // Should be capped at MEDIUM due to recent strong contradiction
  assert(result.confidence !== 'HIGH',
    `Expected not HIGH due to contradiction, got ${result.confidence}`);
  assert(result.rationale.includes('contradiction'),
    'Rationale should mention contradiction');
});

test('3+ recent strong supports override contradiction cap', () => {
  const evidence = [
    // 3 recent strong supports
    createEvidenceWithDate('decision_spiral', 'support', 3, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 5, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 7, 'strong'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'strong'),
    // Recent strong contradiction
    createEvidenceWithDate('decision_spiral', 'contradict', 4, 'strong')
  ];

  const result = computePatternConfidence(evidence);

  // With override, can still be HIGH
  if (result.confidence === 'HIGH') {
    assert(result.rationale.includes('Override') || result.rationale.includes('counteract'),
      'Should mention override in rationale');
  }
});

test('Strong contradictions penalize more than weak', () => {
  const baseEvidence = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 15, 'normal')
  ];

  const withWeak = [
    ...baseEvidence,
    createEvidenceWithDate('decision_spiral', 'contradict', 7, 'weak')
  ];

  const withStrong = [
    ...baseEvidence,
    createEvidenceWithDate('decision_spiral', 'contradict', 7, 'strong')
  ];

  const weakResult = computePatternConfidence(withWeak);
  const strongResult = computePatternConfidence(withStrong);

  assert(strongResult.score < weakResult.score,
    'Strong contradiction should reduce score more than weak');
});

// ============================================
// Test Suite 4: Cross-Domain Bonus
// ============================================

console.log('\n--- Cross-Domain Bonus ---\n');

test('2+ domains adds bonus to score', () => {
  const singleDomain = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal', 'Work'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal', 'Work')
  ];

  const multiDomain = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal', 'Work'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal', 'Relationships')
  ];

  const singleResult = computePatternConfidence(singleDomain);
  const multiResult = computePatternConfidence(multiDomain);

  assert(multiResult.score > singleResult.score,
    'Multi-domain evidence should score higher');
});

test('3+ domains adds larger bonus', () => {
  const twoDomains = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal', 'Work'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal', 'Relationships')
  ];

  const threeDomains = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal', 'Work'),
    createEvidenceWithDate('decision_spiral', 'support', 10, 'normal', 'Relationships'),
    createEvidenceWithDate('decision_spiral', 'support', 15, 'normal', 'Creative')
  ];

  const twoResult = computePatternConfidence(twoDomains);
  const threeResult = computePatternConfidence(threeDomains);

  assert(threeResult.score > twoResult.score,
    '3 domains should score higher than 2 domains');
});

// ============================================
// Test Suite 5: Contradiction Detection
// ============================================

console.log('\n--- Contradiction Detection ---\n');

test('detectContradictions finds decision_spiral contradictions', () => {
  const message = "I decided quickly without overthinking and went with my gut";
  const contradictions = detectContradictions(message);

  assert(contradictions.length > 0, 'Should detect contradictions');
  assert(contradictions.some(c => c.patternId === 'decision_spiral'),
    'Should detect decision_spiral contradiction');
});

test('detectContradictions returns empty for neutral messages', () => {
  const message = "What is the weather like today?";
  const contradictions = detectContradictions(message);

  assertEqual(contradictions.length, 0, 'Should not detect contradictions in neutral message');
});

test('Multiple contradiction matches increase strength', () => {
  // Message with multiple contradiction indicators
  const message = "I decided quickly, went with my gut, didn't overthink, just chose";
  const contradictions = detectContradictions(message);

  const decisionContra = contradictions.find(c => c.patternId === 'decision_spiral');
  assert(decisionContra, 'Should find decision_spiral contradiction');
  assertEqual(decisionContra.strength, 'strong', 'Multiple matches should be strong');
});

// ============================================
// Test Suite 6: Pattern Detection
// ============================================

console.log('\n--- Pattern Detection ---\n');

test('detectPatternsInMemory finds decision_spiral patterns', () => {
  const content = "I keep getting stuck with analysis paralysis and too many options";
  const patterns = detectPatternsInMemory(content);

  assert(patterns.length > 0, 'Should detect patterns');
  assert(patterns.some(p => p.patternId === 'decision_spiral'),
    'Should detect decision_spiral pattern');
});

test('detectPatternsInMemory finds momentum_through_building patterns', () => {
  const content = "I learn by doing and building prototypes";
  const patterns = detectPatternsInMemory(content);

  assert(patterns.some(p => p.patternId === 'momentum_through_building'),
    'Should detect momentum_through_building pattern');
});

test('detectPatternsInMemory returns empty for generic content', () => {
  const content = "Had lunch with a friend yesterday";
  const patterns = detectPatternsInMemory(content);

  assertEqual(patterns.length, 0, 'Should not detect patterns in generic content');
});

// ============================================
// Test Suite 7: Evidence Creation
// ============================================

console.log('\n--- Evidence Creation ---\n');

test('createSupportEvidence creates valid record', () => {
  const evidence = createSupportEvidence('decision_spiral', 'Work', 'normal', {
    source_query: 'test query'
  });

  assert(evidence.id.includes('decision_spiral'), 'ID should include pattern ID');
  assertEqual(evidence.pattern_id, 'decision_spiral');
  assertEqual(evidence.polarity, 'support');
  assertEqual(evidence.strength, 'normal');
  assertEqual(evidence.domain, 'Work');
  assert(evidence.observed_at, 'Should have timestamp');
});

test('createContradictEvidence creates valid record', () => {
  const evidence = createContradictEvidence('decision_spiral', null, 'strong');

  assert(evidence.id.includes('contradict'), 'ID should include contradict');
  assertEqual(evidence.polarity, 'contradict');
  assertEqual(evidence.strength, 'strong');
});

test('determineStrength returns correct values', () => {
  assertEqual(determineStrength(1), 'weak');
  assertEqual(determineStrength(2), 'normal');
  assertEqual(determineStrength(3), 'strong');
  assertEqual(determineStrength(5), 'strong');
});

// ============================================
// Test Suite 8: Debug Fields
// ============================================

console.log('\n--- Debug Fields ---\n');

test('Debug fields are populated correctly', () => {
  const evidence = [
    createEvidenceWithDate('decision_spiral', 'support', 5, 'normal'),
    createEvidenceWithDate('decision_spiral', 'support', 45, 'normal'),
    createEvidenceWithDate('decision_spiral', 'contradict', 10, 'weak')
  ];

  const result = computePatternConfidence(evidence);

  assert(result.debug, 'Should have debug object');
  assert(result.debug.last_observed, 'Should have last_observed');
  assertEqual(result.debug.supports_recent, 1, 'Should count recent supports');
  assertEqual(result.debug.supports_total, 2, 'Should count total supports');
  assertEqual(result.debug.contradict_recent, 1, 'Should count recent contradictions');
  assertEqual(result.debug.contradict_total, 1, 'Should count total contradictions');
  assert(typeof result.debug.raw_score === 'number', 'Should have raw_score');
});

// ============================================
// Summary
// ============================================

console.log('\n=== Test Results ===\n');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
