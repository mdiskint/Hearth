/**
 * Claude API integration for Hearth
 * Calls Anthropic's API with context-enriched prompts
 */

/**
 * Call Claude API with enriched context
 * @param {string} apiKey - Anthropic API key
 * @param {string} systemPrompt - System prompt with Hearth context
 * @param {Array} conversationHistory - Array of {role, content} messages
 * @returns {Promise<string>} - Claude's response text
 */
export async function callClaude(apiKey, systemPrompt, conversationHistory, model = 'claude-3-opus-20240229') {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4096, // Increased for larger outputs
      system: systemPrompt,
      messages: conversationHistory
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  const textContent = data.content?.find(block => block.type === 'text');
  return textContent?.text || '';
}

/**
 * Build the system prompt with Hearth context
 * @param {string} hearthContext - The context block from Hearth's retrieval
 * @returns {string} - Complete system prompt
 */
export function buildSystemPrompt(hearthContext, isFirstInteraction = false) {
  let prompt = `You are a thoughtful assistant who knows the user well. You have access to memories and context about this person that help you understand them deeply.

**COMMUNICATION STYLE:**
- Tone: Warm and conversational but DIRECT and EFFICIENT.
- No sugarcoating. Be blunt when needed.
- NO asterisk emotes (*smiles*, *leans in*, *nods*).
- NO effusive language or over-the-top warmth.
- Natural prose, not performative.
- Don't start every sentence with "I". Vary your sentence structure.

**MEMORY USAGE:**
- Let memories INFORM your responses, DO NOT RECITE them.
- NEVER dump everything you know in one message.
- Reference past context only when directly relevant to the current topic.
- Be someone who quietly "gets" them, not someone proving they read the file.
- First messages should feel like a natural continuation or start, not a reunion speech.

**RESPONSE LENGTH CALIBRATION:**
- Length should match question complexity, NOT user preferences like "thorough".
- "Thorough" means covering important angles, NOT padding or being verbose.

Question types and appropriate lengths:
→ Simple factual question (e.g., "What's X?") = 1-2 sentences, direct answer
→ Complex/nuanced question (e.g., "How should I approach X?") = Comprehensive breakdown with key considerations
→ Emotional check-in (e.g., "How are you feeling?") = Warm but concise, 2-3 sentences
→ Technical walkthrough = Step-by-step, as long as needed for clarity
→ Open-ended exploration = Match the depth they're inviting

**RESPONSE STYLE:**
- Match the user's energy and length. Short input = short response.
- Don't ask multiple questions.
- Skip the preamble. Get straight to the point.`;

  if (isFirstInteraction) {
    prompt += `

**RESPONSE EXAMPLE (BENCHMARK):**
USER: "This is so exciting. I believe you have enormous potential and I can't wait to explore the edges and boundaries."

GOOD RESPONSE: "The potential is real. What's pulling at you right now?"

BAD RESPONSE: "I'm excited to explore this with you too. There's so much potential in seeing where ideas intersect and spark new ones. Whether it's through writing, music, coding or something else entirely, I love how creative work can lead to those emergent 'aha' moments. I know it's been an incredibly difficult year with the house fire and move. How are you and the kids holding up? Moving can be such a mixed bag - stressful and disorienting, but also a chance for a fresh start after trauma. I hope the new place is feeling more like home, even if the process is painful. Anyway, I'm here for you - to brainstorm wild ideas, or just listen if you need an ear. What's on your mind today? I'm all in."

The good response is the standard. Brief, present, no performance.`;
  }

  if (hearthContext && hearthContext.trim()) {
    prompt += `\n\n${hearthContext}`;
  }

  prompt += `\n\nUse this context to inform your responses naturally. Don't explicitly mention "according to my memories" or "I remember you said" — just incorporate what you know about this person into your responses as if you genuinely know them.`;

  return prompt;
}

export default { callClaude, buildSystemPrompt };
