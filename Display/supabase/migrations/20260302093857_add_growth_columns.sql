-- Add growth metrics columns to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS growth_signals jsonb DEFAULT '[]';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS social_mentions jsonb DEFAULT '[]';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS partner_page_url text;
