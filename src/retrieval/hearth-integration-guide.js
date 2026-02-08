/**
 * Hearth Retrieval — Integration Guide
 * =====================================
 *
 * This is a REFERENCE FILE, not executed code.
 * It documents how to wire hearth-retrieval.js into the existing
 * fetch interception pipeline.
 */

// ============================================================
// 1. Import and Initialize
// ============================================================

/*
 * In injector.js (or wherever chrome.storage keys are available):
 *
 *   import { init, retrieve } from '../src/retrieval/hearth-retrieval.js';
 *
 *   // During HearthInjector.init(), after loading keys from storage:
 *   init({
 *     supabaseUrl:    'https://wkfwtivvhwyjlkyrikeu.supabase.co',
 *     supabaseAnonKey: SUPABASE_ANON_KEY,        // from chrome.storage
 *     openaiApiKey:    data.openaiKey,             // from chrome.storage
 *     overrides: {
 *       // Optional — all have sensible defaults:
 *       // SIMILARITY_THRESHOLD: 0.35,
 *       // MAX_CANDIDATES: 15,
 *       // MAX_USER_MEMORIES: 3,
 *       // MAX_AI_MEMORIES: 3,
 *       // MIN_SCORE: 0.15,
 *     }
 *   });
 *
 *
 * NOTE: Because Chrome extensions inject scripts into page context
 * via <script> tags (CSP constraints), you may need to bundle
 * hearth-retrieval.js or expose it as a web_accessible_resource
 * and load it the same way affectDetector.js is loaded today.
 *
 * The simplest path: add it to injectExtraModules() in injector.js
 * and expose window.HearthRetrieval = { init, retrieve }.
 */

// ============================================================
// 2. Where It Plugs into the Pipeline
// ============================================================

/*
 * The fetch interception pipeline in fetch-interceptor.js currently
 * follows this order inside the monkeypatched window.fetch:
 *
 *   1. Parse request body
 *   2. Extract user message             (extractUserMessage)
 *   3. Load manifest                     (loadManifest)
 *   4. Select OpSpec                     (selectOpSpec)
 *   5. Build injection context           (buildInjectionContext — OpSpec + narrative bridge)
 *   6. Detect affect                     (HearthAffectDetector.detectAffect)
 *   7. >>> MEMORY RETRIEVAL GOES HERE <<< (new)
 *   8. Assemble full context             (OpSpec + affect + memories)
 *   9. Inject into request body          (injectContext)
 *
 * In the current code (fetch-interceptor.js ~line 670-694), after
 * affect detection produces `affectSection`, add the retrieval call:
 *
 *   // --- existing code ---
 *   let affectSection = '';
 *   if (capturedUserMessage && window.HearthAffectDetector) {
 *     const shape = window.HearthAffectDetector.detectAffect(capturedUserMessage);
 *     const complement = window.HearthAffectDetector.generateComplement(shape);
 *     if (complement.opspec) {
 *       affectSection = `\n\n${complement.opspec}`;
 *     }
 *   }
 *
 *   // --- NEW: Memory retrieval ---
 *   let memorySection = '';
 *   if (capturedUserMessage && window.HearthRetrieval) {
 *     try {
 *       // Pass affect shape if available for accurate heat computation
 *       const affectShape = window.HearthAffectDetector
 *         ? window.HearthAffectDetector.detectAffect(capturedUserMessage)
 *         : undefined;
 *
 *       const result = await window.HearthRetrieval.retrieve(
 *         capturedUserMessage,
 *         { affectShape }
 *       );
 *
 *       if (result.injection) {
 *         memorySection = `\n\n${result.injection}`;
 *         console.log('Hearth: Retrieved memories',
 *           `heat=${result.heat.toFixed(2)}`,
 *           `goal=${result.goal}`,
 *           `user=${result.userMemories.length}`,
 *           `ai=${result.aiMemories.length}`
 *         );
 *       }
 *     } catch (e) {
 *       console.warn('Hearth: Retrieval failed, continuing without memories', e);
 *       // Fail open — no memories is fine
 *     }
 *   }
 *
 *   // --- Assemble full context ---
 *   const fullContext = routedOpSpec
 *     ? `${routedOpSpec}\n\n${context}${affectSection}${memorySection}`
 *     : `${context}${affectSection}${memorySection}`;
 */

// ============================================================
// 3. Injection Ordering
// ============================================================

/*
 * The final injected text prepended to the user's message follows
 * this structure:
 *
 *   1. Routed OpSpec (if selectOpSpec matched a specialized module)
 *   2. Base OpSpec + Narrative Bridge   (buildInjectionContext)
 *   3. Affect Complement                (affectSection)
 *   4. Memories                         (memorySection)
 *   5. --- original user message ---
 *
 * This ordering matters:
 *   - OpSpec sets behavioral tone before any data arrives
 *   - Affect tunes HOW the model responds (pace, containment, etc.)
 *   - Memories provide WHAT the model knows about the person
 *   - Memories come last so they're closest to the user's message
 *     in the context window, maximizing attention weight
 */

// ============================================================
// 4. Performance Notes
// ============================================================

/*
 * Added latency per message: ~150-200ms typical
 *
 *   - OpenAI embedding:       ~80-120ms  (1 API call, text-embedding-3-small)
 *   - Supabase vector search: ~40-80ms   (2 parallel RPC calls via Promise.all)
 *   - Scoring + selection:    <1ms       (local computation)
 *   - Access tracking:        0ms added  (fire-and-forget, non-blocking)
 *
 * Heat-gated queries below 0.1 heat skip the entire pipeline (0ms added).
 * Cold greetings like "hi" or "thanks" never trigger retrieval.
 *
 * If the OpenAI embedding call fails, the pipeline returns null
 * injection immediately — no Supabase calls are made.
 *
 * The Supabase match_memories function runs server-side pgvector
 * IVFFlat index scans. With 854 memories this is well under the
 * threshold where index performance matters; expect sub-10ms DB time.
 */

// ============================================================
// 5. Tuning Guide
// ============================================================

/*
 * TOO NOISY (irrelevant memories surfacing):
 *   - Raise SIMILARITY_THRESHOLD from 0.35 -> 0.45
 *   - Raise MIN_SCORE from 0.15 -> 0.25
 *   - Lower MAX_USER_MEMORIES / MAX_AI_MEMORIES from 3 -> 2
 *   - Consider narrowing temporal windows (edit getTemporalWindow)
 *
 * TOO AGGRESSIVE (memories not appearing when they should):
 *   - Lower SIMILARITY_THRESHOLD from 0.35 -> 0.25
 *   - Lower MIN_SCORE from 0.15 -> 0.10
 *   - Widen temporal windows
 *   - Check heat estimation: is estimateHeatFromQuery returning
 *     values too low? The 0.1 gate is aggressive.
 *
 * WRONG MEMORIES FOR THE GOAL:
 *   - Adjust the TYPE_WEIGHTS matrix in hearth-retrieval.js
 *   - Each row is a goal category; each column is a memory type
 *   - Values range 0.0 (irrelevant) to 1.0 (maximally relevant)
 *   - Example: if emotional queries are surfacing too many facts,
 *     lower TYPE_WEIGHTS.emotional.fact from 0.3 -> 0.1
 *
 * VALIDATION LIFECYCLE:
 *   - Currently all 854 memories have validation_state = "untested"
 *   - Untested memories get a 0.7 multiplier (30% penalty vs validated)
 *   - As the validation system activates, validated memories will
 *     naturally float higher and invalidated ones will drop out
 *   - Adjust VALIDATION_PRECISION values if the spread is too
 *     aggressive or too mild
 *
 * HEAT CALIBRATION:
 *   - If affect shapes are available (HearthAffectDetector loaded),
 *     computeHeatFromAffect is used — this is the most accurate path
 *   - The regex fallback (estimateHeatFromQuery) is coarse; tune the
 *     pattern lists and default values in that function
 *   - The temporal window mapping in getTemporalWindow controls how
 *     far back each heat tier searches
 */

// ============================================================
// 6. Example Injection Output
// ============================================================

/*
 * For a query like "I've been thinking about whether I should
 * leave my job — I'm scared but excited about freelancing":
 *
 *   heat:  0.50  (from affect shape or regex: reflective/uncertain)
 *   goal:  decisional
 *   window: 30 days
 *
 * Injected text:
 *
 *   [MEMORIES]
 *   What you know about this person:
 *   - Values autonomy and creative control over their work
 *   - Has 18 months of runway saved if they went freelance
 *   - Previously mentioned feeling trapped in corporate structure
 *
 *   What you've learned from working with them:
 *   - When facing big decisions, benefits from exploring worst-case scenarios first — it actually reduces anxiety rather than increasing it
 *   - Tends to underweight emotional data when making "rational" decisions, then regrets it later
 *   [/MEMORIES]
 *
 * This injection appears AFTER the OpSpec and affect complement,
 * BEFORE the user's actual message in the prompt.
 */

// ============================================================
// 7. Quick-Start Checklist
// ============================================================

/*
 * [ ] Add hearth-retrieval.js to web_accessible_resources in manifest.json
 * [ ] Load it in injector.js injectExtraModules() or equivalent
 * [ ] Expose as window.HearthRetrieval = { init, retrieve }
 * [ ] Call init() with Supabase + OpenAI credentials during startup
 * [ ] Add retrieval call in fetch-interceptor.js after affect detection
 * [ ] Append result.injection to fullContext
 * [ ] Test with: window.__HEARTH_DEBUG_RETRIEVAL__ = true in console
 * [ ] Verify cold queries ("hi", "thanks") produce no retrieval
 * [ ] Verify warm queries surface relevant memories
 * [ ] Check console for timing: "Hearth: Retrieved memories heat=... goal=..."
 */
