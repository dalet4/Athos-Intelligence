-- Consolidated Schema Migration Script

-- Add core intelligence columns
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS partners text[];
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS revenue_estimate text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS directors jsonb;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS awards jsonb;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS partner_page_url text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS growth_signals jsonb;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS social_mentions jsonb;

-- Add corporate structure columns
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS parent_company text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_group_member boolean DEFAULT false;

-- Phase 2: BuiltWith & Company Intelligence
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS tech_stack jsonb DEFAULT '[]'::jsonb;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS headcount text;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS office_locations text[] DEFAULT '{}'::text[];

-- Add partner_managers column
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS partner_managers jsonb DEFAULT '[]'::jsonb;

-- Add Lead Scoring columns (Restoration)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}'::jsonb;

-- Recursive Discovery columns
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS sibling_agencies jsonb DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN agencies.partner_managers IS 'Direct contacts for partnerships (Strategy, Execution, Tech, Marketing)';
COMMENT ON COLUMN agencies.tech_stack IS 'Technology stack extracted via BuiltWith and AI';
COMMENT ON COLUMN agencies.headcount IS 'Estimated or actual number of employees';

-- Verification Query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agencies';
