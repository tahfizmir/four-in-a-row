-- init.sql: create games table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  moves JSONB,
  winner_username TEXT,
  loser_username TEXT,
  is_bot BOOLEAN DEFAULT false,
  result_reason TEXT
);
