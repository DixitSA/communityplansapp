-- Agent inbox: an owner-run agent (Codex / Claude) posts events through the agent-inbox Edge Function.
-- They land as PENDING submissions with no submitter; only admins can see them. Nothing auto-publishes.

alter table public.event_submissions
  add column origin text not null default 'user' check (origin in ('user', 'agent', 'instagram')),
  add column source_handle text check (char_length(source_handle) <= 100),
  add column ends_at timestamptz,
  add column address text check (char_length(address) <= 200),
  add column agent_fingerprint text;

alter table public.event_submissions alter column submitted_by drop not null;

alter table public.event_submissions
  add constraint event_submissions_origin_submitter_check check ((origin = 'user') = (submitted_by is not null)),
  add constraint event_submissions_ends_after_start_check check (ends_at is null or ends_at > starts_at);

-- Idempotent re-submits: the function inserts with on conflict (agent_fingerprint) do nothing.
-- Unique indexes already allow many nulls, so this is "unique where not null" without a partial predicate,
-- which PostgREST's on_conflict (used by supabase-js upsert) cannot target.
create unique index event_submissions_agent_fingerprint_key
  on public.event_submissions (agent_fingerprint);

-- RLS is unchanged: "see own submissions" compares submitted_by to auth.uid(), and null never matches, so agent rows
-- are visible to admins only. Grants are unchanged too: authenticated can select, and update only the review columns,
-- so the new columns are not writable by clients. submit_event() leaves origin at its default 'user'.
