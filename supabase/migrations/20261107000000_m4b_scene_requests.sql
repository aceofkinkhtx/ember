-- M4b: scene requests.
--
-- Either person in a connection can design a scene for the other: a bottom
-- for their Top, or a switch in either role. The design travels as a request,
-- sealed to the recipient's key on the sender's phone, so the server sees only
-- who sent it to whom, when, and whether it was accepted. The recipient
-- accepts (and gets their own editable copy) or declines; the sender sees which.

create table public.scene_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  sealed_scene text not null,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index scene_requests_to on public.scene_requests (to_id);
create index scene_requests_from on public.scene_requests (from_id);

alter table public.scene_requests enable row level security;

create policy "scene requests: sender and recipient read" on public.scene_requests
  for select to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));
create policy "scene requests: sent only to a connection" on public.scene_requests
  for insert to authenticated
  with check (from_id = (select auth.uid()) and status = 'sent' and public.is_connected(from_id, to_id));
create policy "scene requests: recipient answers" on public.scene_requests
  for update to authenticated
  using (to_id = (select auth.uid())) with check (to_id = (select auth.uid()) and status in ('accepted', 'declined'));
create policy "scene requests: either person removes" on public.scene_requests
  for delete to authenticated
  using (from_id = (select auth.uid()) or to_id = (select auth.uid()));

-- The recipient can only change the answer, never the design or who sent it.
revoke update on public.scene_requests from authenticated;
grant update (status, updated_at) on public.scene_requests to authenticated;

-- Ending a connection also withdraws any requests between the two people.
create or replace function public.guard_connection_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  by_server boolean := coalesce(current_setting('ember.server_change', true), '') = 'on';
  me uuid := (select auth.uid());
begin
  if not by_server then
    if old.status = 'ended' and new.status <> 'ended' then
      raise exception 'This connection has ended. Send a new invite to reconnect.';
    end if;
    if old.status = 'paused' and new.status = 'active' and old.paused_by is distinct from me then
      raise exception 'Only the person who paused this connection can resume it.';
    end if;
    if (new.role_a is distinct from old.role_a and me is distinct from old.user_a)
       or (new.role_b is distinct from old.role_b and me is distinct from old.user_b) then
      raise exception 'You can only change your own role.';
    end if;
  end if;

  new.paused_by := case when new.status = 'paused' then coalesce(old.paused_by, me) else null end;

  if new.status = 'ended' and old.status <> 'ended' then
    delete from public.profile_shares
    where (owner_id = new.user_a and recipient_id = new.user_b)
       or (owner_id = new.user_b and recipient_id = new.user_a);
    delete from public.toy_shares
    where (owner_id = new.user_a and recipient_id = new.user_b)
       or (owner_id = new.user_b and recipient_id = new.user_a);
    delete from public.scene_requests
    where (from_id = new.user_a and to_id = new.user_b)
       or (from_id = new.user_b and to_id = new.user_a);
  end if;
  return new;
end;
$$;
