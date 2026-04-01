-- Add missing columns to agencies table for enhanced enrichment data

alter table public.agencies
add column if not exists awards jsonb default '[]'::jsonb,
add column if not exists directors jsonb default '[]'::jsonb,
add column if not exists partners text[] default array[]::text[];
