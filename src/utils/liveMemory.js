/**
 * Live Memory Accumulation
 * Captures significant moments in real-time as the user chats
 */

import { callClaude } from '../api/claude.js';
import { db } from '../services/database';

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
 * Check if a message is significant enough to extract as a memory
 * @param {string} apiKey - Anthropic API key
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Recent conversation context
 * @param {string} model - Claude model to use
 * @returns {Promise<boolean>} - True if significant
 */
export async function checkSignificance(apiKey, userMessage, conversationHistory = [], model = 'claude-3-opus-20240229') {
    try {
        // Build context from recent messages
        const recentContext = conversationHistory
            .slice(-6)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

        const prompt = `User just said: "${userMessage}"\n\nRecent context:\n${recentContext}`;

        const response = await callClaude(apiKey, SIGNIFICANCE_PROMPT, [{
            role: 'user',
            content: prompt
        }], model);

        return response.toLowerCase().includes('yes');
    } catch (err) {
        console.error('Significance check error:', err);
        return false;
    }
}

/**
 * Extract a memory from a significant message
 * @param {string} apiKey - Anthropic API key
 * @param {string} userMessage - The user's message
 * @param {Array} conversationHistory - Recent conversation context
 * @param {string} userEOS - User's EOS (preferences/identity)
 * @param {string} model - Claude model to use
 * @returns {Promise<Object|null>} - Extracted memory or null
 */
export async function extractLiveMemory(apiKey, userMessage, conversationHistory = [], userEOS = '', model = 'claude-3-opus-20240229') {
    try {
        const recentContext = conversationHistory
            .slice(-6)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

        const prompt = `Extract a memory from this message:\n\n"${userMessage}"\n\nContext:\n${recentContext}`;

        const response = await callClaude(apiKey, getLiveExtractionPrompt(userEOS), [{
            role: 'user',
            content: prompt
        }], model);

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('No JSON in live extraction response');
            return null;
        }

        const memory = JSON.parse(jsonMatch[0]);

        // Add metadata
        return {
            ...memory,
            id: `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created: new Date().toISOString(),
            last_accessed: null,
            access_count: 0,
            source: 'live_chat'
        };
    } catch (err) {
        console.error('Live extraction error:', err);
        return null;
    }
}

/**
 * Save a memory to the memory store (Supabase + localStorage fallback)
 * @param {Object} memory - Memory object to save
 * @param {string} userId - Optional user ID for cloud sync
 * @returns {Promise<boolean>} - Success status
 */
export async function saveMemoryToStore(memory, userId = null) {
    try {
        console.log('Memory saved:', memory);

        // Save to Supabase if user is logged in
        if (userId) {
            try {
                await db.addMemory(userId, memory);
                console.log('Memory synced to cloud');
            } catch (dbErr) {
                console.error('Failed to sync memory to cloud:', dbErr);
            }
        }

        // Store in localStorage as a fallback/cache
        const stored = JSON.parse(localStorage.getItem('liveMemories') || '[]');
        stored.push(memory);
        localStorage.setItem('liveMemories', JSON.stringify(stored));

        return true;
    } catch (err) {
        console.error('Save memory error:', err);
        return false;
    }
}

/**
 * Get all live-captured memories from localStorage
 * @returns {Array} - Array of memory objects
 */
export function getLiveMemories() {
    try {
        return JSON.parse(localStorage.getItem('liveMemories') || '[]');
    } catch (err) {
        console.error('Get live memories error:', err);
        return [];
    }
}

/**
 * Clear all live memories
 */
export function clearLiveMemories() {
    localStorage.removeItem('liveMemories');
}
