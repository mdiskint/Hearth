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
export async function callClaude(apiKey, systemPrompt, conversationHistory) {
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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
export function buildSystemPrompt(hearthContext) {
  let prompt = `You are a thoughtful assistant who knows the user well. You have access to memories and context about this person that help you understand them deeply.`;

  if (hearthContext && hearthContext.trim()) {
    prompt += `\n\n${hearthContext}`;
  }

  prompt += `\n\nUse this context to inform your responses naturally. Don't explicitly mention "according to my memories" or "I remember you said" — just incorporate what you know about this person into your responses as if you genuinely know them. Be warm, insightful, and helpful.`;

  return prompt;
}

export default { callClaude, buildSystemPrompt };
