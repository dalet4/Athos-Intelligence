-- Add partner_managers column to agencies table
ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS partner_managers JSONB DEFAULT '[]'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.agencies.partner_managers IS 'Extract of partner managers, alliances, and partnership leads from the agency website, enriched by Hunter.io.';
