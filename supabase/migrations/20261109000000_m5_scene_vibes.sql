-- M5: SceneVibe sharing and plan requests.
--
-- The Top shares a scene's SceneVibe with the bottom: the shape of the scene,
-- never the plan, sealed to the bottom's key on the Top's phone. The bottom can
-- ask for the full plan; the Top sends it (also sealed to the bottom) or says
-- not this time. The server sees who shared with whom, when, and whether a plan
-- was asked for, sent or declined, never what's in either.

create table public.scene_vibes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  -- The Top's own scene id, so an update replaces the earlier SceneVibe.
  scene_ref uuid not null,
  sealed_vibe text not null,
  sealed_plan text,
  plan_requested_at timestamptz,
  plan_declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, scene_ref),
  check (owner_id <> recipient_id)
);
create index scene_vibes_recipient on public.scene_vibes (recipient_id);

alter table public.scene_vibes enable row level security;

create policy "scene vibes: Top and recipient read" on public.scene_vibes
  for select to authenticated
  using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "scene vibes: shared only with a connection" on public.scene_vibes
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_connected(owner_id, recipient_id)
    and sealed_plan is null
    and plan_requested_at is null
    and plan_declined_at is null
  );
create policy "scene vibes: Top and recipient update their own parts" on public.scene_vibes
  for update to authenticated
  using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "scene vibes: either person removes" on public.scene_vibes
  for delete to authenticated
  using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()));

revoke update on public.scene_vibes from authenticated;
grant update (sealed_vibe, sealed_plan, plan_requested_at, plan_declined_at, updated_at) on public.scene_vibes to authenticated;

-- Each person may change only their own part: the bottom asks for the plan;
-- the Top updates the SceneVibe and sends or declines the plan.
create or replace function public.guard_scene_vibe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me = old.recipient_id then
    if new.sealed_vibe is distinct from old.sealed_vibe
       or new.sealed_plan is distinct from old.sealed_plan
       or new.plan_declined_at is distinct from old.plan_declined_at then
      raise exception 'Only the Top can change the SceneVibe or the plan.';
    end if;
    -- Asking (or asking again) is stamped by the server.
    if new.plan_requested_at is distinct from old.plan_requested_at then
      new.plan_requested_at := now();
    end if;
  elsif me = old.owner_id then
    if new.plan_requested_at is distinct from old.plan_requested_at then
      raise exception 'Only the bottom can ask for the plan.';
    end if;
    if new.plan_declined_at is distinct from old.plan_declined_at and new.plan_declined_at is not null then
      new.plan_declined_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_scene_vibe
  before update on public.scene_vibes
  for each row execute function public.guard_scene_vibe();

-- Ending a connection also withdraws every SceneVibe and plan between the two.
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
    delete from public.scene_vibes
    where (owner_id = new.user_a and recipient_id = new.user_b)
       or (owner_id = new.user_b and recipient_id = new.user_a);
  end if;
  return new;
end;
$$;
