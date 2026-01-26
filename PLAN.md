# OpSpec Interpretation Implementation Plan

## Overview

Add an explicit OpSpec Interpretation pass that extracts a structured "modulation profile" from the user's OpSpec. This profile tells the Judge HOW to apply interventions (force style) without changing WHAT interventions to apply (Scout confidence remains binding).

## Architecture

```
OpSpec (prose) → interpretOpSpec() → OpSpecProfile → buildInjectionContext() → Judge receives profile
```

The profile modulates:
- How many options to present
- Whether to prioritize predictability vs novelty
- Whether to suggest irreversible action
- How direct the language is

**Critical constraint:** Profile does NOT override balance protocol or Scout confidence. It only changes "force application style".

## Files to Create

### 1. `/hearth/utils/opspec/interpretOpSpec.js`

Main interpretation module with:

```javascript
/**
 * OpSpecProfile structure
 */
const OpSpecProfile = {
  // Core modulation axes (5 axes)
  frictionTolerance: 'low' | 'med' | 'high',      // Can they handle pushback?
  ambiguityTolerance: 'low' | 'med' | 'high',     // Can they sit with uncertainty?
  reassuranceNeed: 'low' | 'med' | 'high',        // Do they need validation?
  noveltyAppetite: 'low' | 'med' | 'high',        // Open to unexpected suggestions?
  directnessPreference: 'low' | 'med' | 'high',   // Blunt vs gentle delivery?

  // Confidence for each axis
  axisConfidence: {
    frictionTolerance: { level: 'high'|'med'|'low', rationale: string },
    ambiguityTolerance: { level: 'high'|'med'|'low', rationale: string },
    reassuranceNeed: { level: 'high'|'med'|'low', rationale: string },
    noveltyAppetite: { level: 'high'|'med'|'low', rationale: string },
    directnessPreference: { level: 'high'|'med'|'low', rationale: string }
  },

  // Hard constraints (parsed from constraints array)
  hardConstraints: {
    neverBeBlunt: boolean,
    neverSugarcoat: boolean,
    neverDecideForUser: boolean,
    neverOverwhelm: boolean,
    alwaysGiveOptions: boolean,
    // ... other extracted constraints
  },

  // Metadata
  interpretedAt: ISO8601,
  sourceHash: string  // For cache invalidation
};
```

**Interpretation logic:**
- Parse `identity`, `communication`, `execution`, `constraints` fields
- Use keyword/phrase scoring with explicit thresholds
- No LLM calls - pure regex + heuristics
- Transparent, auditable scoring

**Keyword patterns for each axis:**

| Axis | High Indicators | Low Indicators |
|------|-----------------|----------------|
| frictionTolerance | "direct feedback", "challenge me", "push back", "don't sugarcoat" | "gentle", "careful", "supportive", "encouraging" |
| ambiguityTolerance | "explore", "sit with uncertainty", "tangents welcome", "open-ended" | "clear answers", "definitive", "closure", "certainty" |
| reassuranceNeed | "validate", "check in", "confirm", "make sure" | "trust me", "I know what I want", "don't hand-hold" |
| noveltyAppetite | "surprise me", "unexpected", "creative", "experiment" | "predictable", "proven", "conservative", "safe" |
| directnessPreference | "blunt", "direct", "no hedging", "straight talk" | "diplomatic", "gentle", "soften", "careful wording" |

### 2. `/hearth/utils/opspec/index.js`

Module exports for the opspec utilities.

## Files to Modify

### 1. `/hearth/content/fetch-interceptor.js`

**Location:** After Scout analysis (~line 1248), before buildInjectionContext()

**Changes:**
1. Add inline `interpretOpSpec()` function (since runs in page context)
2. Call interpretation after Scout analysis
3. Pass profile to `buildInjectionContext()`

```javascript
// After Scout analysis
const scoutAnalysis = analyzeWithScout(relevantMemories, capturedUserMessage);

// NEW: Interpret OpSpec for Judge modulation
const opspecProfile = interpretOpSpec(hearthData.opspec);
console.log('Hearth: OpSpec profile:', opspecProfile.frictionTolerance, 'friction,',
            opspecProfile.directnessPreference, 'directness');

// Build context with profile
const context = buildInjectionContext(hearthData.opspec, relevantMemories, scoutAnalysis, opspecProfile);
```

**Modify `buildInjectionContext()` signature:**
```javascript
function buildInjectionContext(opspec, memories, scoutAnalysis = null, opspecProfile = null)
```

**Add new section to output:**
```
---

JUDGE MODULATION PROFILE

Friction Tolerance: HIGH (confidence: high)
  → Can handle direct pushback and challenge

Ambiguity Tolerance: HIGH (confidence: med)
  → Comfortable with open-ended exploration

Reassurance Need: LOW (confidence: high)
  → Does not need validation; trusts own judgment

Novelty Appetite: HIGH (confidence: med)
  → Open to unexpected suggestions and tangents

Directness Preference: HIGH (confidence: high)
  → Wants blunt, unhedged communication

Hard Constraints:
  - Never sugarcoat feedback
  - Never decide without presenting options
  - Never use corporate language

Application guidance:
  - Present 2-3 focused options (not exhaustive lists)
  - Favor direct language over diplomatic hedging
  - Comfortable suggesting irreversible actions when confident
  - Challenge assumptions rather than validate them
```

### 2. `/hearth/manifest.json`

Add new files to `web_accessible_resources`:
```json
"utils/opspec/interpretOpSpec.js"
```

### 3. `/hearth/README.md`

Add new section: "OpSpec Interpretation → Judge Modulation"

## Tests

### `/hearth/tests/opspec-interpretation.test.js`

Three test cases:

**Test A: High friction tolerance user (current default)**
```javascript
const opspecA = {
  identity: "Creative experimenter who learns by building...",
  communication: "Natural and conversational. Comprehensive but tight...",
  execution: "Give me options and let me decide...",
  constraints: [
    "Never sugarcoat feedback - be direct and blunt",
    "Never use excessive formatting",
    "Never decide for me without presenting options"
  ]
};

// Expected profile:
{
  frictionTolerance: 'high',
  ambiguityTolerance: 'high',
  reassuranceNeed: 'low',
  noveltyAppetite: 'high',
  directnessPreference: 'high'
}
```

**Test B: Low friction tolerance user (opposite)**
```javascript
const opspecB = {
  identity: "Careful planner who prefers proven approaches...",
  communication: "Gentle and supportive. Take time to explain...",
  execution: "Guide me step by step. Check in frequently...",
  constraints: [
    "Never be too direct or blunt",
    "Never overwhelm with options",
    "Always validate my thinking first"
  ]
};

// Expected profile:
{
  frictionTolerance: 'low',
  ambiguityTolerance: 'low',
  reassuranceNeed: 'high',
  noveltyAppetite: 'low',
  directnessPreference: 'low'
}
```

**Test C: Analytical user (different profile)**
```javascript
const opspecC = {
  identity: "Analytical thinker who values precision and evidence...",
  communication: "Precise and technical. Include citations when possible...",
  execution: "Show your reasoning. I want to understand the logic...",
  constraints: [
    "Never speculate without flagging uncertainty",
    "Never skip the reasoning",
    "Always cite sources when available"
  ]
};

// Expected profile:
{
  frictionTolerance: 'med',
  ambiguityTolerance: 'low',
  reassuranceNeed: 'low',
  noveltyAppetite: 'med',
  directnessPreference: 'med'
}
```

## Decay Mechanism Hooks

The codebase already has recency concepts via:
- Memory `createdAt`/`updatedAt` timestamps
- Scout's `calculateRecencyDays()` function
- Heat-based temporal filtering

**Scaffold for profile decay:**
```javascript
// In OpSpecProfile
{
  interpretedAt: new Date().toISOString(),
  sourceHash: hashOpSpec(opspec),  // MD5 or simple string hash

  // Future: decay hooks
  // lastValidated: null,  // When user confirmed profile accuracy
  // decayFactor: 1.0      // Reduce confidence over time without validation
}
```

Profile re-interpretation triggers:
1. OpSpec changes (detected via sourceHash)
2. Manual re-interpretation request
3. (Future) Periodic decay if not validated

## Implementation Sequence

1. Create `/utils/opspec/interpretOpSpec.js` with:
   - Keyword pattern definitions
   - Scoring functions for each axis
   - Hard constraint extraction
   - Main `interpretOpSpec()` function

2. Create `/utils/opspec/index.js` for exports

3. Modify `/content/fetch-interceptor.js`:
   - Add inline interpretation code
   - Update `buildInjectionContext()` signature
   - Add `buildProfileSection()` function
   - Wire up in fetch interception flow

4. Update `/manifest.json` with new files

5. Create `/tests/opspec-interpretation.test.js` with 3 test cases

6. Update `/README.md` with documentation section

## Key Design Decisions

**Why keyword scoring instead of LLM?**
- Zero latency impact
- Fully auditable
- No API costs
- Deterministic results

**Why 5 axes instead of 6?**
- `identityThreatSensitivity` was in original spec but overlaps with `frictionTolerance` and `reassuranceNeed`
- Keeping it minimal per constraint

**Why inline in fetch-interceptor?**
- Runs in page context (IIFE)
- Cannot import modules
- Must be self-contained (same as Scout)

**Why confidence on each axis?**
- Preserves uncertainty
- Prevents treating profile as "truth"
- Allows Judge to weight recommendations

## Warning: Drift-by-Selection Pressure

This module exists because:
1. The same cognitive architecture (Hearth/Scout/Judge) should work for different users
2. Without explicit interpretation, the system would implicitly optimize for one personality type
3. The balance protocol must remain constant; only "force application style" changes
4. Profile axes are situational levers, not permanent traits

**The profile is a hypothesis about HOW to help, not WHO the user is.**
