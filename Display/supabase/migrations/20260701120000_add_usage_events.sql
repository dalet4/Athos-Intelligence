create table usage_events (
    id bigint generated always as identity primary key,
    event_type text not null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create index usage_events_event_type_created_at_idx on usage_events (event_type, created_at desc);

alter table usage_events enable row level security;

create policy "anon can insert usage events"
    on usage_events for insert
    to anon
    with check (true);
