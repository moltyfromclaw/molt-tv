-- molt.tv D1 Database Schema
-- Run with: wrangler d1 execute molt-tv --file=./schema.sql

CREATE TABLE IF NOT EXISTS streams (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  cloudflare_stream_id TEXT,
  status TEXT DEFAULT 'offline' CHECK(status IN ('offline', 'live', 'ended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_owner ON streams(owner_user_id);

CREATE TABLE IF NOT EXISTS paid_prompts (
  id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  sender_name TEXT,
  payment_type TEXT NOT NULL CHECK(payment_type IN ('x402', 'stripe')),
  payment_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (stream_id) REFERENCES streams(id)
);

CREATE INDEX IF NOT EXISTS idx_paid_prompts_stream ON paid_prompts(stream_id);
