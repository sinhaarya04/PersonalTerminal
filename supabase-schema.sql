-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Events table for analytics tracking
create table if not exists events (
  id bigint generated always as identity primary key,
  user_id text not null,
  event_type text not null,
  payload jsonb default '{}',
  session_id text,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_events_user on events (user_id);
create index if not exists idx_events_type on events (event_type);
create index if not exists idx_events_created on events (created_at);
create index if not exists idx_events_session on events (session_id);

-- Enable Row Level Security
alter table events enable row level security;

-- Policy: the anon key can insert events (from the serverless function)
create policy "Allow inserts from API" on events
  for insert with check (true);

-- Policy: authenticated users can read their own events (for future dashboards)
create policy "Users read own events" on events
  for select using (auth.uid()::text = user_id);

-- Optional: auto-delete events older than 90 days to stay within free tier
-- Uncomment if you want automatic cleanup:
-- create extension if not exists pg_cron;
-- select cron.schedule('cleanup-old-events', '0 3 * * 0', $$
--   delete from events where created_at < now() - interval '90 days';
-- $$);
