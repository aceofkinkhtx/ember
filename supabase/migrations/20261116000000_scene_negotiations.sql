-- Scene negotiations (Michael, Nov 16).
--
-- Either person in a connection proposes a scene as a plain list: what they
-- want to do, feel or experience. The other keeps, removes or adds items and
-- sends it back, or approves it as is. It goes back and forth until one of
-- them approves the other's latest version; then the Top designs from it.
--
-- The list is sealed on the phone twice, once to each person's key, so the
-- server sees only who is negotiating, whose turn it is, and whether it's
-- agreed. Each turn queues a generic phone alert: "A scene request is waiting".

create table public.negotiations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  starter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  other_id uuid not null references auth.users (id) on delete cascade,
  sealed_for_starter text not null check (length(sealed_for_starter) < 200000),
  sealed_for_other text not null check (length(sealed_for_other) < 200000),
  status text not null default 'open' check (status in ('open', 'agreed')),
  -- Whose move it is while open; null once agreed.
  turn_id uuid references auth.users (id) on delete cascade,
  -- Who sent or approved the latest version (set by the server).
  last_by uuid references auth.users (id) on delete set null,
  round integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starter_id <> other_id),
  check ((status = 'open') = (turn_id is not null))
);
create index negotiations_connection on public.negotiations (connection_id);

alter table public.negotiations enable row level security;

create policy "negotiations: the two people read" on public.negotiations
  for select to authenticated
  using (starter_id = (select auth.uid()) or other_id = (select auth.uid()));

create policy "negotiations: start with a connection" on public.negotiations
  for insert to authenticated
  with check (
    starter_id = (select auth.uid())
    and status = 'open'
    and turn_id = other_id
    and public.is_member(connection_id, starter_id)
    and public.is_member(connection_id, other_id)
    and public.is_connected(starter_id, other_id)
  );

create policy "negotiations: the two people answer" on public.negotiations
  for update to authenticated
  using (starter_id = (select auth.uid()) or other_id = (select auth.uid()))
  with check (starter_id = (select auth.uid()) or other_id = (select auth.uid()));

create policy "negotiations: either person removes" on public.negotiations
  for delete to authenticated
  using (starter_id = (select auth.uid()) or other_id = (select auth.uid()));

revoke all on public.negotiations from anon, authenticated;
grant select, insert, delete on public.negotiations to authenticated;
grant update (sealed_for_starter, sealed_for_other, status, turn_id, updated_at) on public.negotiations to authenticated;

-- Turns: only the person whose move it is can answer an open negotiation, and
-- the move always passes to the other person or ends it as agreed. Either
-- person can reopen an agreed one ("Ask to add"), which passes it across.
create or replace function public.guard_negotiation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  them uuid;
begin
  if tg_op = 'INSERT' then
    new.last_by := me;
    new.round := 1;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if me is null then
    return new; -- the server itself
  end if;
  them := case when me = old.starter_id then old.other_id else old.starter_id end;
  if not public.is_connected(old.starter_id, old.other_id) then
    raise exception 'This connection has ended.';
  end if;
  if old.status = 'open' and old.turn_id is distinct from me then
    raise exception 'It''s their turn. You''ll get an alert when they answer.';
  end if;
  if new.status = 'open' and new.turn_id is distinct from them then
    raise exception 'A negotiation always goes back to the other person.';
  end if;
  if new.status = 'agreed' and old.status <> 'open' then
    raise exception 'This is already agreed.';
  end if;
  new.last_by := me;
  new.round := old.round + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_negotiation
  before insert or update on public.negotiations
  for each row execute function public.guard_negotiation();

-- Phone alerts --------------------------------------------------------------------

alter table public.reminders drop constraint reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('post', 'debrief', 'followup', 'checkin', 'message', 'negotiation'));

create or replace function public.queue_negotiation_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := new.last_by;
  recipient uuid := case when new.status = 'open' then new.turn_id
                         when new.last_by = new.starter_id then new.other_id
                         else new.starter_id end;
begin
  if recipient is null or recipient = sender then
    return new;
  end if;
  if exists (select 1 from public.blocks b where b.blocker_id = recipient and b.blocked_id = sender) then
    return new;
  end if;
  if not exists (select 1 from public.reminders r where r.user_id = recipient and r.kind = 'negotiation' and r.sent_at is null) then
    insert into public.reminders (user_id, kind, due_at) values (recipient, 'negotiation', now());
  end if;
  return new;
end;
$$;

create trigger queue_negotiation_alert
  after insert or update on public.negotiations
  for each row execute function public.queue_negotiation_alert();

revoke all on function public.guard_negotiation(), public.queue_negotiation_alert() from public, anon, authenticated;

-- Ending a connection removes its negotiations ------------------------------------

create or replace function public.end_connection_negotiations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ended' and old.status <> 'ended' then
    delete from public.negotiations where connection_id = new.id;
  end if;
  return new;
end;
$$;

create trigger end_connection_negotiations
  after update of status on public.connections
  for each row execute function public.end_connection_negotiations();

revoke all on function public.end_connection_negotiations() from public, anon, authenticated;
