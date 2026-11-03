-- M1: connection cards.
-- Each person in a connection writes a small card (name and pronouns) locked
-- with the connection's shared key, so the other person can see who they are
-- connected to while the server sees only a locked box.

create table public.connection_cards (
  connection_id uuid not null references public.connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sealed_card text not null check (char_length(sealed_card) <= 8000),
  updated_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);

alter table public.connection_cards enable row level security;

create policy "connection cards: members read" on public.connection_cards
  for select to authenticated using (public.is_member(connection_id, (select auth.uid())));
create policy "connection cards: write own" on public.connection_cards
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(connection_id, (select auth.uid())));
create policy "connection cards: update own" on public.connection_cards
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_member(connection_id, (select auth.uid())));

revoke all on public.connection_cards from anon, authenticated;
grant select, insert, update on public.connection_cards to authenticated;
