CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('fact', 'value', 'partner_model')),
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
