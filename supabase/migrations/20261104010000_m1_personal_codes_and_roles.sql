-- M1: personal codes, connection requests, and each person's own role.
--
-- Michael's decisions (Nov 3, 2026):
-- - Anyone can keep a permanent personal code. Typing it shows the owner's
--   scene name and role, and sends a request the owner accepts or declines.
--   There is no searchable directory.
-- - Each person picks their own role in each connection: Top, bottom or
--   switch. Two switches can connect. Two Tops or two bottoms can't, because
--   no scene could be planned between them.

-- Connections: two people, each with their own role -------------------------

alter table public.connections rename column top_id to user_a;
alter table public.connections rename column bottom_id to user_b;
alter table public.connections add column role_a text not null default 'top' check (role_a in ('top', 'bottom', 'switch'));
alter table public.connections add column role_b text not null default 'bottom' check (role_b in ('top', 'bottom', 'switch'));
alter table public.connections alter column role_a drop default;
alter table public.connections alter column role_b drop default;
alter table public.connections add constraint connections_roles_fit check (not (role_a = role_b and role_a <> 'switch'));
alter table public.connections drop constraint connections_top_id_bottom_id_key;
create unique index connections_pair on public.connections (least(user_a, user_b), greatest(user_a, user_b));

create or replace function public.is_connected(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    where c.status <> 'ended'
      and ((c.user_a = a and c.user_b = b) or (c.user_a = b and c.user_b = a))
  );
$$;

create or replace function public.is_member(conn uuid, who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    where c.id = conn and (c.user_a = who or c.user_b = who)
  );
$$;

-- People may change the status and their own role, nothing else.
revoke update on public.connections from authenticated;
grant update (status, role_a, role_b) on public.connections to authenticated;

-- Changes made by Ember's own functions (accepting an invite or a request)
-- carry a marker that people can't set themselves.
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
  end if;
  return new;
end;
$$;

drop trigger if exists guard_connection_status on public.connections;
create trigger guard_connection_status
  before update on public.connections
  for each row execute function public.guard_connection_status();

-- Makes or reopens a connection between two people with their chosen roles.
create or replace function public.connect_people(a uuid, a_role text, b uuid, b_role text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  conn uuid;
begin
  if a_role not in ('top', 'bottom', 'switch') or b_role not in ('top', 'bottom', 'switch') then
    raise exception 'Choose Top, bottom or switch.';
  end if;
  if a_role = b_role and a_role <> 'switch' then
    raise exception 'Those roles don''t fit together. One of you needs to Top or switch, and the other to bottom or switch.';
  end if;

  perform set_config('ember.server_change', 'on', true);
  insert into public.connections (user_a, user_b, role_a, role_b)
  values (a, b, a_role, b_role)
  on conflict ((least(user_a, user_b)), (greatest(user_a, user_b))) do update
    set status = 'active',
        role_a = case when public.connections.user_a = excluded.user_a then excluded.role_a else excluded.role_b end,
        role_b = case when public.connections.user_a = excluded.user_a then excluded.role_b else excluded.role_a end
  returning id into conn;
  perform set_config('ember.server_change', '', true);
  return conn;
end;
$$;

-- Invites: the inviter may also be a switch -----------------------------------

alter table public.invites drop constraint invites_inviter_role_check;
alter table public.invites add constraint invites_inviter_role_check check (inviter_role in ('top', 'bottom', 'switch'));

drop function public.accept_invite(text);
create or replace function public.accept_invite(invite_code text, my_role text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inv public.invites%rowtype;
  conn uuid;
begin
  if me is null then
    raise exception 'Sign in to accept an invite';
  end if;

  select * into inv from public.invites where code = upper(invite_code) for update;
  if not found or inv.kind <> 'account' then
    raise exception 'This invite was not found';
  end if;
  if inv.used_at is not null then
    raise exception 'This invite has already been used';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite has expired';
  end if;
  if inv.created_by = me then
    raise exception 'You cannot accept your own invite';
  end if;

  conn := public.connect_people(
    inv.created_by, inv.inviter_role,
    me, coalesce(my_role, case inv.inviter_role when 'top' then 'bottom' when 'bottom' then 'top' else 'switch' end)
  );
  update public.invites set used_at = now(), used_by = me where id = inv.id;
  return conn;
end;
$$;

-- Invite codes never repeat a personal code.
create or replace function public.set_invite_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  loop
    new.code := public.random_code(case when new.kind = 'guest' then 24 else 8 end);
    exit when not exists (select 1 from public.personal_codes p where p.code = new.code);
  end loop;
  new.created_at := now();
  if new.expires_at > new.created_at + interval '30 days' then
    raise exception 'Invites last at most 30 days';
  end if;
  return new;
end;
$$;

-- Personal codes ------------------------------------------------------------

create table public.personal_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4,20}$'),
  -- Shown to anyone who types the code. The owner chooses it, and it is the
  -- only name Ember keeps readable on the server.
  scene_name text not null check (char_length(btrim(scene_name)) between 1 and 40),
  role text not null check (role in ('top', 'bottom', 'switch')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personal_codes enable row level security;
create policy "personal codes: owner reads" on public.personal_codes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "personal codes: owner creates" on public.personal_codes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "personal codes: owner changes" on public.personal_codes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "personal codes: owner deletes" on public.personal_codes
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.personal_codes from anon, authenticated;
grant select, insert, update, delete on public.personal_codes to authenticated;

create or replace function public.normalize_personal_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := upper(btrim(new.code));
  new.scene_name := btrim(new.scene_name);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  end if;
  if exists (select 1 from public.invites i where i.code = new.code) then
    raise exception 'That code is taken. Try another.';
  end if;
  return new;
end;
$$;

create trigger personal_codes_normalize
  before insert or update on public.personal_codes
  for each row execute function public.normalize_personal_code();

-- What someone sees when they type a personal code: scene name and role.
create or replace function public.get_personal_code(personal_code text)
returns table (scene_name text, role text, owner_public_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.scene_name, p.role, k.public_key
  from public.personal_codes p
  join public.public_keys k on k.user_id = p.user_id
  where p.code = upper(btrim(personal_code)) and p.active;
$$;

-- Connection requests -------------------------------------------------------

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  from_role text not null check (from_role in ('top', 'bottom', 'switch')),
  -- The requester's scene name and pronouns, sealed for the recipient only.
  sealed_card text not null check (char_length(sealed_card) <= 8000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  -- Requests from someone the recipient blocked are kept out of their sight.
  -- The sender can't read this column, so a block is never revealed.
  silenced boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_id <> to_id)
);
create unique index connection_requests_one_pending on public.connection_requests (from_id, to_id) where status = 'pending';

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.connection_requests enable row level security;
alter table public.blocks enable row level security;

create policy "requests: sender reads" on public.connection_requests
  for select to authenticated using (from_id = (select auth.uid()));
create policy "requests: recipient reads, unless blocked" on public.connection_requests
  for select to authenticated using (to_id = (select auth.uid()) and not silenced);
create policy "requests: sender withdraws or clears" on public.connection_requests
  for delete to authenticated using (from_id = (select auth.uid()));
create policy "blocks: blocker reads" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "blocks: blocker unblocks" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

revoke all on public.connection_requests, public.blocks from anon, authenticated;
grant select (id, from_id, to_id, from_role, sealed_card, status, created_at, decided_at) on public.connection_requests to authenticated;
grant delete on public.connection_requests to authenticated;
grant select, delete on public.blocks to authenticated;

create or replace function public.send_request(personal_code text, my_role text, card text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target public.personal_codes%rowtype;
begin
  if me is null then
    raise exception 'Sign in to send a request';
  end if;
  select * into target from public.personal_codes where code = upper(btrim(personal_code)) and active;
  if not found then
    raise exception 'That code was not found';
  end if;
  if target.user_id = me then
    raise exception 'That is your own code';
  end if;
  if my_role not in ('top', 'bottom', 'switch') then
    raise exception 'Choose Top, bottom or switch.';
  end if;
  if card is null or char_length(card) = 0 or char_length(card) > 8000 then
    raise exception 'That request could not be sent';
  end if;
  if public.is_connected(me, target.user_id) then
    raise exception 'You are already connected';
  end if;
  if exists (select 1 from public.connection_requests r where r.from_id = me and r.to_id = target.user_id and r.status = 'pending') then
    raise exception 'Your request is already waiting';
  end if;
  if (select count(*) from public.connection_requests r where r.from_id = me and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent a lot of requests today. Try again tomorrow.';
  end if;

  insert into public.connection_requests (from_id, to_id, from_role, sealed_card, silenced)
  values (
    me, target.user_id, my_role, card,
    exists (select 1 from public.blocks b where b.blocker_id = target.user_id and b.blocked_id = me)
  );
end;
$$;

create or replace function public.respond_request(request_id uuid, accept boolean, my_role text default null, block boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  req public.connection_requests%rowtype;
  conn uuid;
begin
  select * into req from public.connection_requests
  where id = request_id and to_id = me and status = 'pending' and not silenced
  for update;
  if not found then
    raise exception 'This request is no longer waiting';
  end if;

  if accept then
    conn := public.connect_people(
      req.from_id, req.from_role,
      me, coalesce(my_role, case req.from_role when 'top' then 'bottom' when 'bottom' then 'top' else 'switch' end)
    );
    update public.connection_requests set status = 'accepted', decided_at = now() where id = req.id;
    return conn;
  end if;

  update public.connection_requests set status = 'declined', decided_at = now() where id = req.id;
  if block then
    insert into public.blocks (blocker_id, blocked_id) values (me, req.from_id) on conflict do nothing;
  end if;
  return null;
end;
$$;

-- Function access -------------------------------------------------------------

revoke all on function public.connect_people(uuid, text, uuid, text), public.accept_invite(text, text),
  public.normalize_personal_code(), public.get_personal_code(text), public.send_request(text, text, text),
  public.respond_request(uuid, boolean, text, boolean), public.guard_connection_status(), public.set_invite_code()
  from public, anon, authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.get_personal_code(text) to anon, authenticated;
grant execute on function public.send_request(text, text, text) to authenticated;
grant execute on function public.respond_request(uuid, boolean, text, boolean) to authenticated;
