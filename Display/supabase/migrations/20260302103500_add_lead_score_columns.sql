-- Add lead_score and score_breakdown columns to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}'::jsonb;

-- Update existing records if needed (default values already set)
