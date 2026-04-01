-- Add competitor_partnerships column to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS competitor_partnerships jsonb DEFAULT '[]';
