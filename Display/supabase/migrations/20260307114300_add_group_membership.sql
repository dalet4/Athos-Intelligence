-- Add parent company and group membership tracking to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_group_member boolean DEFAULT false;
