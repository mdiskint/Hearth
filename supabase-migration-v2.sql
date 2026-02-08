-- Hearth Memory Schema V2: Full Paper Implementation
-- Run this in Supabase SQL Editor

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns to existing memories table
ALTER TABLE memories 
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS intensity FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS validation_state TEXT DEFAULT 'untested' 
    CHECK (validation_state IN ('untested', 'validated', 'invalidated', 'provisional', 'consolidated', 'outdated')),
  ADD COLUMN IF NOT EXISTS validation_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS life_domain TEXT 
    CHECK (life_domain IN ('work', 'relationships', 'creative', 'self', 'decisions', 'resources', 'values')),
  ADD COLUMN IF NOT EXISTS emotional_state TEXT 
    CHECK (emotional_state IN ('joy', 'curiosity', 'pride', 'peace', 'grief', 'fear', 'anxiety', 'shame', 'anger', 'care')),
  ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'user' 
    CHECK (memory_type IN ('user', 'ai')),
  ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_validated TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS durability TEXT DEFAULT 'contextual'
    CHECK (durability IN ('ephemeral', 'contextual', 'durable'));

-- Update type constraint to include new memory types
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_type_check;
ALTER TABLE memories ADD CONSTRAINT memories_type_check 
  CHECK (type IN ('fact', 'value', 'partner_model', 'reward', 'synthesis', 'self_model'));

-- Create index on embedding for fast similarity search
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index on life_domain and emotional_state for dimensional queries
CREATE INDEX IF NOT EXISTS memories_dimensions_idx ON memories (life_domain, emotional_state);

-- Create index on memory_type for separating user/ai memories
CREATE INDEX IF NOT EXISTS memories_type_idx ON memories (memory_type);

-- Create index on validation_state for filtering
CREATE INDEX IF NOT EXISTS memories_validation_idx ON memories (validation_state);

-- Create index on created_at for temporal queries
CREATE INDEX IF NOT EXISTS memories_created_idx ON memories (created_at DESC);

-- Function to search memories by embedding similarity
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  filter_memory_type TEXT DEFAULT NULL,
  filter_life_domain TEXT DEFAULT NULL,
  min_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  type TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  intensity FLOAT,
  validation_state TEXT,
  life_domain TEXT,
  emotional_state TEXT,
  memory_type TEXT,
  durability TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.type,
    m.source,
    m.created_at,
    m.intensity,
    m.validation_state,
    m.life_domain,
    m.emotional_state,
    m.memory_type,
    m.durability,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE 
    m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
    AND (filter_memory_type IS NULL OR m.memory_type = filter_memory_type)
    AND (filter_life_domain IS NULL OR m.life_domain = filter_life_domain)
    AND (min_date IS NULL OR m.created_at >= min_date)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to update memory access stats for a batch of memories
CREATE OR REPLACE FUNCTION touch_memories(memory_ids UUID[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE memories
  SET 
    last_accessed = NOW(),
    access_count = COALESCE(access_count, 0) + 1
  WHERE id = ANY(memory_ids);
END;
$$;

-- Function to update validation state
CREATE OR REPLACE FUNCTION validate_memory(
  memory_id UUID,
  new_state TEXT,
  increment_count BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE memories
  SET 
    validation_state = new_state,
    validation_count = CASE WHEN increment_count THEN validation_count + 1 ELSE validation_count END,
    last_validated = NOW()
  WHERE id = memory_id;
END;
$$;

-- View for dimensional coverage (gap detection)
CREATE OR REPLACE VIEW memory_dimension_coverage AS
SELECT 
  life_domain,
  emotional_state,
  COUNT(*) as memory_count,
  AVG(intensity) as avg_intensity,
  MAX(created_at) as most_recent
FROM memories
WHERE life_domain IS NOT NULL AND emotional_state IS NOT NULL
GROUP BY life_domain, emotional_state;

-- View for identifying gaps (dimensions with no memories)
CREATE OR REPLACE VIEW memory_dimension_gaps AS
WITH all_dimensions AS (
  SELECT d.domain, e.state
  FROM 
    (VALUES ('work'), ('relationships'), ('creative'), ('self'), ('decisions'), ('resources'), ('values')) AS d(domain),
    (VALUES ('joy'), ('curiosity'), ('pride'), ('peace'), ('grief'), ('fear'), ('anxiety'), ('shame'), ('anger'), ('care')) AS e(state)
)
SELECT 
  ad.domain as life_domain,
  ad.state as emotional_state
FROM all_dimensions ad
LEFT JOIN memories m ON m.life_domain = ad.domain AND m.emotional_state = ad.state
WHERE m.id IS NULL;
