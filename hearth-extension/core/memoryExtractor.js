/**
 * Live Memory Extraction for Chrome Extension
 * Detects and extracts significant memories from AI conversations
 */

// Significance Detection Prompt (Fast/Cheap)
const SIGNIFICANCE_PROMPT = `You detect personal significance in messages.

Answer YES if the message reveals:
- Life events (loss, move, diagnosis, major change)
- Identity statements ("I am...", "I have...", "I struggle with...")
- Emotional vulnerability (fear, shame, hidden truth)
- Relationship details (family, spouse, kids)
- Core values or drives
- Something a close friend would remember

Answer NO if it's:
- Technical questions or requests
- Project work or logistics
- Small talk or greetings
- Transactional exchanges

Reply with only YES or NO.`;

// Live Extraction Prompt (Uses EOS)
const getLiveExtractionPrompt = (userEOS) => `You are extracting a memory from a conversation.

**WHO THIS PERSON IS:**
${userEOS || 'No EOS available yet - extract based on the message alone.'}

**TASK:** 
Create ONE memory from what they just said. First-person voice.

**OUTPUT:**
{
  "content": "The memory in their voice",
  "summary": "3-5 word title",
  "domains": ["Self"],
  "emotions": ["Pride"],
  "intensity": 0.7
}

Use these domains: Work, Relationships, Creative, Self, Decisions, Resources
Use these emotions: Fear, Anger, Shame, Grief, Anxiety, Joy, Pride, Love, Curiosity, Peace

Output ONLY valid JSON.`;

/**
 * Call Claude API
 */
async function callClaude(apiKey, systemPrompt, messages, model = 'claude-3-haiku-20240307') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model,
            max_tokens: 1024,
            system: systemPrompt,
            messages
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Claude API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
        });
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

/**
 * Check if a message is significant
 */
export async function checkSignificance(apiKey, userMessage, conversationContext = []) {
    try {
        const recentContext = conversationContext
            .slice(-4)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

        const prompt = `User just said: "${userMessage}"\n\nRecent context:\n${recentContext}`;

        const response = await callClaude(apiKey, SIGNIFICANCE_PROMPT, [{
            role: 'user',
            content: prompt
        }], 'claude-3-haiku-20240307'); // Use Haiku for speed/cost

        return response.toLowerCase().includes('yes');
    } catch (err) {
        console.error('❌ Significance check error:', err);
        return false;
    }
}

/**
 * Extract a memory from a significant message
 */
export async function extractMemory(apiKey, userMessage, conversationContext = [], userEOS = '') {
    try {
        const recentContext = conversationContext
            .slice(-4)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

        const prompt = `Extract a memory from this message:\n\n"${userMessage}"\n\nContext:\n${recentContext}`;

        const response = await callClaude(apiKey, getLiveExtractionPrompt(userEOS), [{
            role: 'user',
            content: prompt
        }], 'claude-3-haiku-20240307');

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('⚠️ No JSON in extraction response');
            return null;
        }

        const memory = JSON.parse(jsonMatch[0]);

        // Add metadata
        return {
            ...memory,
            id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created: new Date().toISOString(),
            created_at: new Date().toISOString(),
            last_accessed: null,
            access_count: 0,
            source: 'extension'
        };
    } catch (err) {
        console.error('❌ Memory extraction error:', err);
        return null;
    }
}
/**
 * Enrich an existing memory with metadata
 */
export async function enrichMemoryMetadata(apiKey, memoryContent) {
    try {
        const prompt = `Analyze this memory and assign metadata.

**MEMORY:**
"${memoryContent}"

**TASK:**
Assign domains, emotions, and intensity (0.0-1.0).

**DOMAINS:** Work, Relationships, Creative, Self, Decisions, Resources
**EMOTIONS:** Fear, Anger, Shame, Grief, Anxiety, Joy, Pride, Love, Curiosity, Peace

**OUTPUT JSON:**
{
  "domains": ["..."],
  "emotions": ["..."],
  "intensity": 0.8
}

Output ONLY valid JSON.`;

        const response = await callClaude(apiKey, 'You are a psychological analyzer.', [{
            role: 'user',
            content: prompt
        }], 'claude-3-haiku-20240307');

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        return JSON.parse(jsonMatch[0]);
    } catch (err) {
        console.error('❌ Enrichment error:', err);
        return null;
    }
}
