-- The Top chooses when their after-scene check-in reminder comes (Michael,
-- Nov 26). It defaults to 12 hours (it was 18), from 1 to 72 hours. Only the
-- Top's own call sets the time of their reminder; a call from the bottom
-- schedules it at the default if the Top hasn't yet. Everything else is as before.
--   Top:    post (now), check in with the bottom (+their hours), follow-ups (+1, +2, +3 days)
--   bottom: post (now), debrief (+3 hours), follow-ups (+1, +2, +3 days)

drop function if exists public.schedule_after_scene(uuid);

create function public.schedule_after_scene(vibe uuid, checkin_hours int default 12)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v public.scene_vibes;
  d int;
  h int := least(greatest(coalesce(checkin_hours, 12), 1), 72);
begin
  select * into v from public.scene_vibes where id = vibe;
  if v.id is null or (me is distinct from v.owner_id and me is distinct from v.recipient_id) then
    raise exception 'This scene is not shared with you.';
  end if;
  insert into public.reminders (user_id, vibe_id, kind, day, due_at) values
    (v.owner_id, v.id, 'post', 0, now()),
    (v.recipient_id, v.id, 'post', 0, now()),
    (v.recipient_id, v.id, 'debrief', 0, now() + interval '3 hours')
  on conflict do nothing;
  if me = v.owner_id then
    insert into public.reminders (user_id, vibe_id, kind, day, due_at)
    values (v.owner_id, v.id, 'checkin', 0, now() + make_interval(hours => h))
    on conflict (user_id, vibe_id, kind, day) do update
      set due_at = public.reminders.created_at + make_interval(hours => h)
      where public.reminders.sent_at is null and public.reminders.done_at is null;
  else
    insert into public.reminders (user_id, vibe_id, kind, day, due_at)
    values (v.owner_id, v.id, 'checkin', 0, now() + interval '12 hours')
    on conflict do nothing;
  end if;
  for d in 1..3 loop
    insert into public.reminders (user_id, vibe_id, kind, day, due_at) values
      (v.owner_id, v.id, 'followup', d, now() + make_interval(days => d)),
      (v.recipient_id, v.id, 'followup', d, now() + make_interval(days => d))
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function public.schedule_after_scene(uuid, int) from public, anon;
grant execute on function public.schedule_after_scene(uuid, int) to authenticated;
