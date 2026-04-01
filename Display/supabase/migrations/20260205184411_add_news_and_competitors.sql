-- Add columns for News Feed and Competitor Intelligence

alter table public.agencies
add column if not exists latest_news jsonb default '[]'::jsonb,
add column if not exists competitor_partners text[] default array[]::text[];
