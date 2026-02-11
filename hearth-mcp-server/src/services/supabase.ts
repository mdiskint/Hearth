import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ScoredMemory, Memory, ScoutPattern } from "../types.js";

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables. " +
        "Set these to connect to your Hearth Supabase project."
    );
  }

  supabase = createClient(url, key);
  return supabase;
}

/**
 * Retrieve memories using the heat-gated composite scoring function.
 * This is the primary retrieval path — it respects heat windows,
 * temporal depth, and validation state.
 */
export async function retrieveMemories(
  queryEmbedding: number[],
  queryHeat: number = 0.5,
  minSimilarity: number = 0.35,
  maxCandidates: number = 20
): Promise<ScoredMemory[]> {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc("retrieve_memories", {
    query_embedding: JSON.stringify(queryEmbedding),
    query_heat: queryHeat,
    min_similarity: minSimilarity,
    max_candidates: maxCandidates,
  });

  if (error) {
    throw new Error(`Memory retrieval failed: ${error.message}`);
  }

  return (data ?? []) as ScoredMemory[];
}

/**
 * Simpler semantic search without heat-gating.
 * Useful for broad searches or when heat context isn't available.
 */
export async function matchMemories(
  queryEmbedding: number[],
  options: {
    similarityThreshold?: number;
    maxResults?: number;
    memoryPool?: "user" | "ai" | "all";
    memoryClass?: "fact" | "pattern" | null;
  } = {}
): Promise<ScoredMemory[]> {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc("match_memories", {
    query_embedding: JSON.stringify(queryEmbedding),
    similarity_threshold: options.similarityThreshold ?? 0.3,
    max_results: options.maxResults ?? 15,
    memory_pool: options.memoryPool ?? "all",
    filter_memory_class: options.memoryClass ?? null,
  });

  if (error) {
    throw new Error(`Memory match failed: ${error.message}`);
  }

  return (data ?? []) as ScoredMemory[];
}

/**
 * Record that memories were accessed (updates access_count and last_accessed).
 */
export async function recordMemoryAccess(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;

  const client = getSupabaseClient();

  const { error } = await client.rpc("record_memory_access", {
    memory_ids: memoryIds,
  });

  if (error) {
    console.error(`Failed to record memory access: ${error.message}`);
    // Non-fatal — don't throw
  }
}

/**
 * Store a new memory. Used for bidirectional memory creation —
 * the model can write memories during conversation.
 */
export async function storeMemory(memory: {
  content: string;
  type: string;
  domain: string;
  emotion?: string | null;
  heat?: number;
  memory_class?: "fact" | "pattern";
  memory_type?: "user" | "ai";
  embedding?: number[];
}): Promise<{ id: string }> {
  const client = getSupabaseClient();

  const id = crypto.randomUUID();

  const { error } = await client.from("memories").insert({
    id,
    content: memory.content,
    type: memory.type,
    domain: memory.domain,
    emotion: memory.emotion ?? null,
    heat: memory.heat ?? 0.5,
    memory_class: memory.memory_class ?? "fact",
    memory_type: memory.memory_type ?? "ai",
    validation: "untested",
    validation_state: "untested",
    durability: "contextual",
    embedding: memory.embedding
      ? JSON.stringify(memory.embedding)
      : null,
  });

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`);
  }

  return { id };
}

/**
 * Get all memories for a user, optionally filtered.
 */
export async function listMemories(options: {
  domain?: string;
  memoryClass?: "fact" | "pattern";
  limit?: number;
  minHeat?: number;
} = {}): Promise<Memory[]> {
  const client = getSupabaseClient();

  let query = client
    .from("memories")
    .select("*")
    .order("heat", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.domain) {
    query = query.eq("domain", options.domain);
  }
  if (options.memoryClass) {
    query = query.eq("memory_class", options.memoryClass);
  }
  if (options.minHeat !== undefined) {
    query = query.gte("heat", options.minHeat);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list memories: ${error.message}`);
  }

  return (data ?? []) as Memory[];
}

/**
 * Get scout patterns — behavioral patterns detected across conversations.
 */
export async function getScoutPatterns(options: {
  minConfidence?: string;
  domain?: string;
  limit?: number;
} = {}): Promise<ScoutPattern[]> {
  const client = getSupabaseClient();

  let query = client
    .from("scout_patterns")
    .select("*")
    .order("evidence_count", { ascending: false })
    .limit(options.limit ?? 20);

  if (options.domain) {
    query = query.contains("domains", [options.domain]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get scout patterns: ${error.message}`);
  }

  return (data ?? []) as ScoutPattern[];
}

/**
 * Get the user's OpSpec from Supabase.
 * Falls back to null if none stored (OpSpec may be in extension local storage).
 */
export async function getOpSpec(userId?: string): Promise<Record<string, unknown> | null> {
  const client = getSupabaseClient();

  let query = client.from("opspecs").select("*").limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Failed to get OpSpec: ${error.message}`);
    return null;
  }

  return data?.[0] ?? null;
}

/**
 * Get the active trajectory for a user.
 * Returns the most recent active trajectory or null if none exists.
 */
export async function getActiveTrajectory(userId: string): Promise<{
  compressed: string;
  arcs: string;
  tensions: string;
  drift: string;
  memory_count: number;
  generated_at: string;
} | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("trajectories")
    .select("compressed, arcs, tensions, drift, memory_count, generated_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (error) {
    throw new Error(`Failed to get active trajectory: ${error.message}`);
  }

  return data?.[0] ?? null;
}

/**
 * Validate a memory — update its validation state.
 */
export async function validateMemory(
  memoryId: string,
  newState: "validated" | "invalidated" | "untested"
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from("memories")
    .update({
      validation: newState,
      validation_state: newState,
      validation_count: undefined, // Let the DB handle increment
    })
    .eq("id", memoryId);

  if (error) {
    throw new Error(`Failed to validate memory: ${error.message}`);
  }
}
