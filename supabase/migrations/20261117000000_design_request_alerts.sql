-- A design sent for review alerts the person it was sent to (Michael, Nov 16).
-- It uses the scene request alert ("A scene request is waiting in Ember."),
-- which opens Home, where the "Your turn" card shows the design. Same rules as
-- every alert: none if they blocked the sender, and one waiting alert at most.

create or replace function public.queue_design_request_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'sent' then
    return new;
  end if;
  if exists (select 1 from public.blocks b where b.blocker_id = new.to_id and b.blocked_id = new.from_id) then
    return new;
  end if;
  if not exists (select 1 from public.reminders r where r.user_id = new.to_id and r.kind = 'negotiation' and r.sent_at is null) then
    insert into public.reminders (user_id, kind, due_at) values (new.to_id, 'negotiation', now());
  end if;
  return new;
end;
$$;

create trigger queue_design_request_alert
  after insert on public.scene_requests
  for each row execute function public.queue_design_request_alert();

revoke all on function public.queue_design_request_alert() from public, anon, authenticated;
