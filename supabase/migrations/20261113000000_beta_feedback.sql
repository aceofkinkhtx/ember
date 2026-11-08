-- Beta feedback (Michael, Nov 8). Plain text by design: the page tells testers
-- that Michael reads it as written. Anyone signed in can send it; no one can
-- read it back through the app. Michael reads it in the Supabase dashboard.
-- It goes with the tester's account if they delete it.

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('feedback', 'problem')),
  answers jsonb not null check (pg_column_size(answers) <= 40000),
  app_version text check (length(app_version) <= 20),
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

create policy "beta feedback: send your own" on public.beta_feedback
  for insert to authenticated with check (user_id = (select auth.uid()));

revoke all on public.beta_feedback from anon, authenticated;
grant insert (kind, answers, app_version) on public.beta_feedback to authenticated;
