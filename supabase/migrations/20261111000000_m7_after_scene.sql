-- M7: after the scene and messaging.
--
-- Everything people write is sealed on their phone, as before:
--   scene_notes  check-ins, debriefs and follow-ups. Each note has the
--                author's own sealed copy, and an optional part sealed to the
--                other person for what is shared with them.
--   messages     sealed to the recipient, with a copy sealed to the sender.
-- The server sees only who, when and what kind:
--   reminders    when a check-in is due, so a phone alert can go out on time.
--   push_subscriptions  where to send those alerts (the alert text is always
--                generic, such as "A check-in is waiting in Ember").
--   reports      the one exception, approved by Michael: a report holds the
--                reason and the message text the reporter chose to include, in
--                plain text, readable only from the Supabase dashboard.

-- After-scene notes ------------------------------------------------------------

create table public.scene_notes (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid not null references public.scene_vibes (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('post', 'debrief', 'followup')),
  -- Follow-up day, 1 to 3; 0 for the others.
  day smallint not null default 0 check (day between 0 and 3),
  sealed_self text not null check (length(sealed_self) < 40000),
  sealed_shared text check (length(sealed_shared) < 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vibe_id, author_id, kind, day),
  check (author_id <> recipient_id)
);
create index scene_notes_recipient on public.scene_notes (recipient_id);

alter table public.scene_notes enable row level security;

-- Whether these two people are the Top and the bottom of this scene.
create or replace function public.in_scene(vibe uuid, me uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.scene_vibes v
    where v.id = vibe
      and ((v.owner_id = me and v.recipient_id = other) or (v.recipient_id = me and v.owner_id = other))
  );
$$;

create policy "scene notes: author and recipient read" on public.scene_notes
  for select to authenticated
  using (author_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "scene notes: written by someone in the scene" on public.scene_notes
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.in_scene(vibe_id, author_id, recipient_id));
create policy "scene notes: author edits" on public.scene_notes
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "scene notes: author removes" on public.scene_notes
  for delete to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.scene_notes from anon, authenticated;
grant select, insert, delete on public.scene_notes to authenticated;
grant update (sealed_self, sealed_shared, updated_at) on public.scene_notes to authenticated;

-- Reminders ----------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vibe_id uuid references public.scene_vibes (id) on delete cascade,
  kind text not null check (kind in ('post', 'debrief', 'followup', 'checkin', 'message')),
  day smallint not null default 0 check (day between 0 and 3),
  due_at timestamptz not null,
  sent_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, vibe_id, kind, day)
);
create index reminders_due on public.reminders (due_at) where sent_at is null;

alter table public.reminders enable row level security;

create policy "reminders: own" on public.reminders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reminders: mark own done" on public.reminders
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.reminders from anon, authenticated;
grant select on public.reminders to authenticated;
grant update (done_at) on public.reminders to authenticated;

-- When a scene ends, either person schedules the check-ins for both. Calling
-- it again changes nothing.
--   Top:    post (now), check in with the bottom (+18 hours), follow-ups (+1, +2, +3 days)
--   bottom: post (now), debrief (+3 hours), follow-ups (+1, +2, +3 days)
create or replace function public.schedule_after_scene(vibe uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v public.scene_vibes;
  d int;
begin
  select * into v from public.scene_vibes where id = vibe;
  if v.id is null or (me is distinct from v.owner_id and me is distinct from v.recipient_id) then
    raise exception 'This scene is not shared with you.';
  end if;
  insert into public.reminders (user_id, vibe_id, kind, day, due_at) values
    (v.owner_id, v.id, 'post', 0, now()),
    (v.owner_id, v.id, 'checkin', 0, now() + interval '18 hours'),
    (v.recipient_id, v.id, 'post', 0, now()),
    (v.recipient_id, v.id, 'debrief', 0, now() + interval '3 hours')
  on conflict do nothing;
  for d in 1..3 loop
    insert into public.reminders (user_id, vibe_id, kind, day, due_at) values
      (v.owner_id, v.id, 'followup', d, now() + make_interval(days => d)),
      (v.recipient_id, v.id, 'followup', d, now() + make_interval(days => d))
    on conflict do nothing;
  end loop;
end;
$$;

-- Messages -----------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  sealed_for_recipient text not null check (length(sealed_for_recipient) < 20000),
  sealed_for_sender text not null check (length(sealed_for_sender) < 20000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_thread on public.messages (connection_id, created_at);
create index messages_recipient on public.messages (recipient_id) where read_at is null;

alter table public.messages enable row level security;

-- A blocked sender's messages are kept out of the recipient's sight. The
-- sender can't tell, so a block is never revealed.
create policy "messages: sender reads, recipient reads unless blocked" on public.messages
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or (
      recipient_id = (select auth.uid())
      and not exists (select 1 from public.blocks b where b.blocker_id = recipient_id and b.blocked_id = sender_id)
    )
  );
create policy "messages: only within a connection" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_member(connection_id, sender_id)
    and public.is_member(connection_id, recipient_id)
    and public.is_connected(sender_id, recipient_id)
  );
create policy "messages: recipient marks read" on public.messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy "messages: sender unsends" on public.messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

revoke all on public.messages from anon, authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- A new message queues one alert for the recipient, unless one is already
-- waiting or they blocked the sender.
create or replace function public.queue_message_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.blocks b where b.blocker_id = new.recipient_id and b.blocked_id = new.sender_id) then
    return new;
  end if;
  if not exists (select 1 from public.reminders r where r.user_id = new.recipient_id and r.kind = 'message' and r.sent_at is null) then
    insert into public.reminders (user_id, kind, due_at) values (new.recipient_id, 'message', now());
  end if;
  return new;
end;
$$;

create trigger queue_message_alert
  after insert on public.messages
  for each row execute function public.queue_message_alert();

-- Blocks and reports -----------------------------------------------------------------

create policy "blocks: blocker adds" on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()) and blocked_id <> blocker_id);
grant insert on public.blocks to authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('harassment', 'threats', 'consent', 'spam', 'underage', 'other')),
  details text check (length(details) <= 1000),
  included_text text check (length(included_text) <= 8000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.reports enable row level security;

-- Anyone can report someone they are or were connected to. Nobody can read
-- reports through the app; Michael reads them in the dashboard.
create policy "reports: file about a connection" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.connections c
      where (c.user_a = reporter_id and c.user_b = reported_id) or (c.user_b = reporter_id and c.user_a = reported_id)
    )
  );

revoke all on public.reports from anon, authenticated;
grant insert on public.reports to authenticated;

-- Push subscriptions ---------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh text not null check (length(p256dh) < 200),
  auth text not null check (length(auth) < 100),
  wants_checkins boolean not null default true,
  wants_messages boolean not null default true,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: own" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Ending a connection also removes the messages between the two ----------------------

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
    -- Removing the SceneVibes also removes their notes and reminders.
    delete from public.scene_vibes
    where (owner_id = new.user_a and recipient_id = new.user_b)
       or (owner_id = new.user_b and recipient_id = new.user_a);
    delete from public.messages where connection_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.in_scene(uuid, uuid, uuid), public.schedule_after_scene(uuid), public.queue_message_alert() from public, anon;
grant execute on function public.in_scene(uuid, uuid, uuid), public.schedule_after_scene(uuid) to authenticated;

-- Sending alerts on time -------------------------------------------------------------
--
-- Every 5 minutes, if any alert is due, the database calls the send-reminders
-- function. Its address and a shared secret live in the vault (set once per
-- project, outside this file), so no secret is written here.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'ember-send-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'ember_project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ember_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.reminders
    where sent_at is null and due_at <= now() and due_at > now() - interval '2 days'
  )
  and exists (select 1 from vault.decrypted_secrets where name = 'ember_cron_secret');
  $job$
);
