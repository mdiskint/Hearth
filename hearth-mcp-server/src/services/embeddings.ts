/**
 * Embedding service for generating query vectors.
 * Your existing memories use 1536-dimension embeddings (text-embedding-ada-002
 * or text-embedding-3-small). This service must match that model.
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate an embedding vector for a text query.
 * Uses OpenAI's embedding API to match existing memory vectors.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY environment variable. " +
        "Required for generating query embeddings to search memories."
    );
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Embedding API error (${response.status}): ${errorText}. ` +
        "Check that your OPENAI_API_KEY is valid and has embedding access."
    );
  }

  const data = (await response.json()) as EmbeddingResponse;

  if (!data.data?.[0]?.embedding) {
    throw new Error("Unexpected embedding API response — no embedding returned.");
  }

  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length === 1) return [await generateEmbedding(texts[0])];

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as EmbeddingResponse;

  return data.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
