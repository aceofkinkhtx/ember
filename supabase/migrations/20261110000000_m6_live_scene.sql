-- M6: Live Scene Mode between two phones.
--
-- The pre-scene check and the live scene travel on the SceneVibe the Top
-- already shared with the bottom. Everything is sealed on the sender's phone:
--   sealed_check  Top to bottom: the maybes in the plan, by name, to say yes or no to.
--   sealed_answer bottom to Top: the bottom's part of the pre-scene check.
--   sealed_live   Top to bottom: the scene clock (started, paused, red, ended).
--   sealed_signal bottom to Top: a red or yellow pressed on the bottom's phone.
-- The server sees only that a row changed and when, never what's inside.

alter table public.scene_vibes
  add column sealed_check text,
  add column sealed_answer text,
  add column sealed_live text,
  add column sealed_signal text;

-- A new SceneVibe starts with nothing but the vibe.
drop policy "scene vibes: shared only with a connection" on public.scene_vibes;
create policy "scene vibes: shared only with a connection" on public.scene_vibes
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_connected(owner_id, recipient_id)
    and sealed_plan is null
    and plan_requested_at is null
    and plan_declined_at is null
    and sealed_check is null
    and sealed_answer is null
    and sealed_live is null
    and sealed_signal is null
  );

revoke update on public.scene_vibes from authenticated;
grant update (sealed_vibe, sealed_plan, plan_requested_at, plan_declined_at, sealed_check, sealed_answer, sealed_live, sealed_signal, updated_at)
  on public.scene_vibes to authenticated;

-- Each person may change only their own part.
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
       or new.plan_declined_at is distinct from old.plan_declined_at
       or new.sealed_check is distinct from old.sealed_check
       or new.sealed_live is distinct from old.sealed_live then
      raise exception 'Only the Top can change the SceneVibe, the plan or the scene.';
    end if;
    if new.plan_requested_at is distinct from old.plan_requested_at then
      new.plan_requested_at := now();
    end if;
    -- The bottom answers only a check that was asked.
    if new.sealed_answer is distinct from old.sealed_answer and old.sealed_check is null then
      raise exception 'There is no pre-scene check to answer yet.';
    end if;
  elsif me = old.owner_id then
    if new.plan_requested_at is distinct from old.plan_requested_at then
      raise exception 'Only the bottom can ask for the plan.';
    end if;
    if new.sealed_answer is distinct from old.sealed_answer or new.sealed_signal is distinct from old.sealed_signal then
      raise exception 'Only the bottom can answer the check or send a signal.';
    end if;
    if new.plan_declined_at is distinct from old.plan_declined_at and new.plan_declined_at is not null then
      new.plan_declined_at := now();
    end if;
    -- A new check clears the old answer and signals.
    if new.sealed_check is distinct from old.sealed_check then
      new.sealed_answer := null;
      new.sealed_signal := null;
      new.sealed_live := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
