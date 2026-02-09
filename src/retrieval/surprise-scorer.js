/**
 * Surprise Scorer - KL Divergence for Memory Relevance
 *
 * Measures how much a memory changes the model's predicted response distribution.
 * Higher KL divergence = memory is more "surprising" / relevant to this context.
 *
 * Uses first-token logprobs as a proxy for full response distribution.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const EPSILON = 1e-10; // For missing tokens in KL computation

/**
 * Get the top-20 first-token probability distribution from OpenAI.
 *
 * @param {string} apiKey - OpenAI API key
 * @param {string} systemPrompt - System prompt (OpSpec + context)
 * @param {string} userMessage - User's message
 * @returns {Promise<Map<string, number>>} Token -> probability map (normalized)
 */
async function getFirstTokenDistribution(apiKey, systemPrompt, userMessage) {
  if (!apiKey) {
    throw new Error('OpenAI API key required');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 1,
      temperature: 1.0,
      logprobs: true,
      top_logprobs: 20
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract logprobs from response
  const logprobsData = data.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;

  if (!logprobsData || logprobsData.length === 0) {
    throw new Error('No logprobs returned from API');
  }

  // Convert logprobs to probabilities and build distribution map
  const distribution = new Map();

  for (const entry of logprobsData) {
    const token = entry.token;
    const logprob = entry.logprob;
    // Convert log probability to probability: P = e^logprob
    const probability = Math.exp(logprob);
    distribution.set(token, probability);
  }

  // Normalize to ensure probabilities sum to 1 (they should already be close)
  const total = Array.from(distribution.values()).reduce((sum, p) => sum + p, 0);
  if (total > 0) {
    for (const [token, prob] of distribution) {
      distribution.set(token, prob / total);
    }
  }

  return distribution;
}

/**
 * Compute KL divergence between two token probability distributions.
 *
 * KL(P || Q) = Σ P(t) * log2(P(t) / Q(t))
 *
 * Where P is the "true" distribution and Q is the "model" distribution.
 * Uses epsilon for tokens missing in Q to avoid log(0).
 *
 * @param {Map<string, number>} P - First distribution (e.g., memory-conditioned)
 * @param {Map<string, number>} Q - Second distribution (e.g., baseline)
 * @returns {number} KL divergence in bits
 */
function computeKLDivergence(P, Q) {
  let kl = 0;

  for (const [token, pProb] of P) {
    if (pProb <= 0) continue;

    // Get Q's probability for this token, use epsilon if missing
    const qProb = Q.get(token) || EPSILON;

    // KL contribution: P(t) * log2(P(t) / Q(t))
    kl += pProb * Math.log2(pProb / qProb);
  }

  return kl;
}

/**
 * Compute the surprise score: how much a memory changes the response distribution.
 *
 * Higher score = memory has more impact on predicted response.
 *
 * @param {Map<string, number>} baselineDistribution - Distribution without memory
 * @param {Map<string, number>} memoryConditionedDistribution - Distribution with memory
 * @returns {number} KL divergence score (memory-conditioned || baseline)
 */
function computeSurpriseScore(baselineDistribution, memoryConditionedDistribution) {
  // KL(memory-conditioned || baseline)
  // Measures how much the memory-conditioned distribution diverges from baseline
  return computeKLDivergence(memoryConditionedDistribution, baselineDistribution);
}

/**
 * Full pipeline: get surprise score for a memory given a context.
 *
 * @param {string} apiKey - OpenAI API key
 * @param {string} baseSystemPrompt - System prompt without the memory
 * @param {string} memorySystemPrompt - System prompt with the memory included
 * @param {string} userMessage - User's message
 * @returns {Promise<{score: number, baseline: Map, conditioned: Map}>}
 */
async function scoreMemorySurprise(apiKey, baseSystemPrompt, memorySystemPrompt, userMessage) {
  // Get both distributions in parallel
  const [baseline, conditioned] = await Promise.all([
    getFirstTokenDistribution(apiKey, baseSystemPrompt, userMessage),
    getFirstTokenDistribution(apiKey, memorySystemPrompt, userMessage)
  ]);

  const score = computeSurpriseScore(baseline, conditioned);

  return {
    score,
    baseline,
    conditioned
  };
}

// ============================================================
// Exports
// ============================================================

// Browser export
if (typeof window !== 'undefined') {
  window.HearthSurpriseScorer = {
    getFirstTokenDistribution,
    computeKLDivergence,
    computeSurpriseScore,
    scoreMemorySurprise,
    EPSILON
  };
}

// Node/CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getFirstTokenDistribution,
    computeKLDivergence,
    computeSurpriseScore,
    scoreMemorySurprise,
    EPSILON
  };
}
