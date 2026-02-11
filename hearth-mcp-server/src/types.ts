// Memory types matching Supabase schema
export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  domain: LifeDomain;
  emotion: Emotion | null;
  heat: number;
  memory_class: "fact" | "pattern" | null;
  memory_type: "user" | "ai" | null;
  validation: ValidationState;
  validation_count: number | null;
  intensity: number | null;
  created_at: string;
  updated_at: string;
  last_accessed: string | null;
  access_count: number | null;
  durability: "ephemeral" | "contextual" | "durable" | null;
}

export type MemoryType =
  | "fact"
  | "value"
  | "partner_model"
  | "reward"
  | "synthesis"
  | "self_model";

export type LifeDomain =
  | "Work"
  | "Relationships"
  | "Creative"
  | "Self"
  | "Decisions"
  | "Resources"
  | "Values";

export type Emotion =
  | "Joy"
  | "Curiosity"
  | "Pride"
  | "Peace"
  | "Grief"
  | "Fear"
  | "Anxiety"
  | "Shame"
  | "Anger"
  | "Care";

export type ValidationState = "validated" | "untested" | "invalidated";

// Retrieved memory with scoring
export interface ScoredMemory extends Memory {
  similarity: number;
  heat_match?: number;
  composite_score?: number;
}

// Affect shape vector
export interface AffectShape {
  expansion: number; // -1 (contracted) to 1 (expanded)
  activation: number; // -1 (frozen) to 1 (activated)
  certainty: number; // -1 (uncertain) to 1 (certain)
}

// Affect complement output
export interface AffectComplement {
  shape: AffectShape;
  label: string;
  strategy: string;
  complement_text: string;
}

// OpSpec structure
export interface OpSpec {
  id: string;
  user_id: string;
  identity: string;
  cognitive_architecture: string;
  communication: string;
  execution: string;
  constraints: string | null;
  balance_protocol: string;
  updated_at: string;
}

// Scout pattern
export interface ScoutPattern {
  pattern_id: string;
  verb: string;
  intervention: string;
  confidence: "UNVALIDATED" | "LOW" | "MEDIUM" | "HIGH" | "DORMANT";
  domains: string[];
  evidence_count: number;
  last_seen: string | null;
}
