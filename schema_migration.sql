-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/.../sql)

-- 1. Add 'partners' column (from Round 1)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS partners text[];

-- 2. Add 'revenue_estimate' (from Round 1)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS revenue_estimate text;

-- 3. Add 'directors' (For Names, Roles, LinkedIn)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS directors jsonb;

-- 4. Add 'awards' (For Name + Year)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS awards jsonb;

-- 5. Add 'partner_page_url' (Deep link to Tech Partners)
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS partner_page_url text;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agencies';
