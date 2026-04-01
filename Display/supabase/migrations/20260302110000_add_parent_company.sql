-- Add parent_company and is_group_member columns to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS parent_company TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_group_member BOOLEAN DEFAULT FALSE;

-- Update existing records if needed
COMMENT ON COLUMN agencies.parent_company IS 'The name of the parent company or group';
COMMENT ON COLUMN agencies.is_group_member IS 'Whether the agency is part of a larger group';
