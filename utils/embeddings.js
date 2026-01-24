// embeddings.js - OpenAI embeddings for semantic memory retrieval

/**
 * Generate an embedding vector for text using OpenAI's API
 * @param {string} text - Text to embed
 * @param {string} apiKey - OpenAI API key
 * @returns {Array<number>} Embedding vector (1536 dimensions for text-embedding-3-small)
 */
async function generateEmbedding(text, apiKey) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text is required for embedding');
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  // Truncate text if too long (8191 tokens max, ~32000 chars safe estimate)
  const truncatedText = text.length > 30000 ? text.substring(0, 30000) : text;

  let retries = 3;
  let lastError;

  while (retries > 0) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: truncatedText
        })
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 5;
        console.log(`Hearth Embeddings: Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries--;
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response format from OpenAI API');
      }

      return data.data[0].embedding;

    } catch (error) {
      lastError = error;
      console.error('Hearth Embeddings: Error:', error.message);

      if (retries === 1) {
        throw error;
      }

      retries--;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('Failed to generate embedding after retries');
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {Array<string>} texts - Array of texts to embed
 * @param {string} apiKey - OpenAI API key
 * @returns {Array<Array<number>>} Array of embedding vectors
 */
async function generateEmbeddings(texts, apiKey) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts array is required');
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  // Filter and truncate texts
  const validTexts = texts
    .filter(t => t && typeof t === 'string' && t.trim())
    .map(t => t.length > 30000 ? t.substring(0, 30000) : t);

  if (validTexts.length === 0) {
    return [];
  }

  let retries = 3;
  let lastError;

  while (retries > 0) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: validTexts
        })
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 5;
        console.log(`Hearth Embeddings: Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries--;
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from OpenAI API');
      }

      // Sort by index to maintain order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map(item => item.embedding);

    } catch (error) {
      lastError = error;
      console.error('Hearth Embeddings: Batch error:', error.message);

      if (retries === 1) {
        throw error;
      }

      retries--;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('Failed to generate embeddings after retries');
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {Array<number>} a - First embedding
 * @param {Array<number>} b - Second embedding
 * @returns {number} Cosine similarity (-1 to 1, higher = more similar)
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find most similar memories to a query
 * @param {string} query - Query text
 * @param {Array<Object>} memories - Memories with embeddings
 * @param {string} apiKey - OpenAI API key
 * @param {number} topK - Number of results to return
 * @returns {Array<Object>} Top K most similar memories with scores
 */
async function findSimilarMemories(query, memories, apiKey, topK = 10) {
  if (!query || !memories || memories.length === 0) {
    return [];
  }

  // Filter memories that have embeddings
  const memoriesWithEmbeddings = memories.filter(m => m.embedding && Array.isArray(m.embedding));

  if (memoriesWithEmbeddings.length === 0) {
    console.log('Hearth Embeddings: No memories have embeddings');
    return [];
  }

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query, apiKey);

  // Calculate similarity scores
  const scored = memoriesWithEmbeddings.map(memory => ({
    ...memory,
    similarity: cosineSimilarity(queryEmbedding, memory.embedding)
  }));

  // Sort by similarity (highest first) and return top K
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
}

/**
 * Get OpenAI API key from storage or prompt user
 * @returns {string|null} API key
 */
async function getOpenAIApiKey() {
  try {
    const data = await chrome.storage.local.get('openaiApiKey');
    if (data.openaiApiKey) {
      return data.openaiApiKey;
    }
  } catch (e) {
    console.warn('Hearth Embeddings: Could not access storage for API key');
  }

  const key = prompt(
    'Enter your OpenAI API key for semantic memory search.\n\n' +
    'This enables finding relevant memories based on meaning, not just keywords.\n' +
    'Your key will be stored locally.'
  );

  if (key && key.trim()) {
    try {
      await chrome.storage.local.set({ openaiApiKey: key.trim() });
    } catch (e) {
      console.warn('Hearth Embeddings: Could not save API key');
    }
    return key.trim();
  }

  return null;
}
