-- M1: accounts, connections, invites, guest links and intake versions.
--
-- Privacy model (docs/encryption-plan.md):
-- * Columns named sealed_* or wrapped_* hold data encrypted on the device.
--   The server stores them but cannot read them.
-- * Row-level security is on for every table. Nobody can read a row unless a
--   policy below says so. Writes that touch two people (accepting an invite,
--   guest submissions) go through security definer functions that check
--   every condition, so no client can insert those rows directly.
-- * The server can see: who is connected to whom, timestamps, invite expiry.

-- Profiles: one per account. Holds the person's key material, all locked.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Private key locked with a key derived from the password (on the device).
  wrapped_private_key text not null,
  wrap_salt text not null,
  wrap_params jsonb not null default '{}'::jsonb,
  -- The same private key locked with the recovery code.
  recovery_wrapped_private_key text not null,
  recovery_salt text not null,
  -- Settings and identity (name, pronouns, gender identity, roles), locked.
  sealed_settings text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public keys: anyone may lock something for you with it. Readable by you and
-- by people you are connected to (needed to share profiles and keys).
create table public.public_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  public_key text not null,
  created_at timestamptz not null default now()
);

-- Connections: who Tops in this dynamic. A switch can be top in one and bottom in another.
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  top_id uuid not null references auth.users (id) on delete cascade,
  bottom_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  check (top_id <> bottom_id),
  unique (top_id, bottom_id)
);

-- Each member's copy of the connection key, sealed to their public key.
create table public.connection_keys (
  connection_id uuid not null references public.connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  wrapped_key text not null,
  created_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);

-- Invites. Account invites have a short code a person can type; guest links
-- have a long code and are used once, without an account.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('account', 'guest')),
  -- The inviter's side of the new connection.
  inviter_role text not null check (inviter_role in ('top', 'bottom')),
  suggested_path text check (suggested_path in ('detailed', 'words', 'map')),
  -- The inviter's note, locked with a key that only exists in the link (after the #).
  sealed_note text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '30 days'),
  check (char_length(code) between 8 and 40)
);

-- Guest intake answers, sealed to the inviter's public key on the guest's device.
create table public.guest_submissions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.invites (id) on delete cascade,
  sealed_payload text not null check (char_length(sealed_payload) <= 512000),
  created_at timestamptz not null default now()
);

-- Intake versions. A bottom fills one per scene or reuses an earlier one;
-- scenes (M4) record which version they were designed from.
create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  version integer not null,
  -- Locked with the owner's profile key.
  sealed_intake text not null check (char_length(sealed_intake) <= 512000),
  reused_from uuid references public.intakes (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, version)
);

-- The owner's profile key, sealed for a connection they chose to share with.
-- Deleting a row revokes access (the owner's device also rotates the key).
create table public.profile_shares (
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'full' check (scope in ('full', 'essentials')),
  wrapped_profile_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, recipient_id),
  check (owner_id <> recipient_id)
);

-- Helpers ---------------------------------------------------------------

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
      and ((c.top_id = a and c.bottom_id = b) or (c.top_id = b and c.bottom_id = a))
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
    where c.id = conn and (c.top_id = who or c.bottom_id = who)
  );
$$;

-- Unambiguous letters and digits (no 0/O, 1/I/L) for codes people may type.
create or replace function public.random_code(len integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(len);
  out text := '';
begin
  for i in 0 .. len - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return out;
end;
$$;

-- Row-level security -------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.public_keys enable row level security;
alter table public.connections enable row level security;
alter table public.connection_keys enable row level security;
alter table public.invites enable row level security;
alter table public.guest_submissions enable row level security;
alter table public.intakes enable row level security;
alter table public.profile_shares enable row level security;

-- Profiles: only you.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: create own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Public keys: yours, and your connections'.
create policy "public keys: read own and connections" on public.public_keys
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_connected(user_id, (select auth.uid())));
create policy "public keys: create own" on public.public_keys
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Connections: only the two people in it. Created only by accept_invite.
create policy "connections: members read" on public.connections
  for select to authenticated
  using ((select auth.uid()) in (top_id, bottom_id));
create policy "connections: members update status" on public.connections
  for update to authenticated
  using ((select auth.uid()) in (top_id, bottom_id))
  with check ((select auth.uid()) in (top_id, bottom_id));

-- Connection keys: you read your own copy; a member may store a copy for
-- either member of their connection.
create policy "connection keys: read own" on public.connection_keys
  for select to authenticated using (user_id = (select auth.uid()));
create policy "connection keys: members add" on public.connection_keys
  for insert to authenticated
  with check (public.is_member(connection_id, (select auth.uid())) and public.is_member(connection_id, user_id));

-- Invites: the creator manages their own. Others look one up only by code (get_invite).
create policy "invites: creator reads" on public.invites
  for select to authenticated using (created_by = (select auth.uid()));
create policy "invites: creator creates" on public.invites
  for insert to authenticated
  with check (created_by = (select auth.uid()) and used_at is null and used_by is null);
create policy "invites: creator deletes" on public.invites
  for delete to authenticated using (created_by = (select auth.uid()));

-- Guest submissions: only the person who sent the guest link can read them.
create policy "guest submissions: inviter reads" on public.guest_submissions
  for select to authenticated
  using (exists (select 1 from public.invites i where i.id = invite_id and i.created_by = (select auth.uid())));

-- Intakes: the owner writes; people they shared with can read.
create policy "intakes: owner reads" on public.intakes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "intakes: shared read" on public.intakes
  for select to authenticated
  using (
    exists (
      select 1 from public.profile_shares s
      where s.owner_id = intakes.owner_id and s.recipient_id = (select auth.uid())
    )
    and public.is_connected(owner_id, (select auth.uid()))
  );
create policy "intakes: owner creates" on public.intakes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "intakes: owner deletes" on public.intakes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Profile shares: the owner grants and revokes; the recipient can read theirs.
create policy "profile shares: owner and recipient read" on public.profile_shares
  for select to authenticated
  using ((select auth.uid()) in (owner_id, recipient_id));
create policy "profile shares: owner grants to a connection" on public.profile_shares
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_connected(owner_id, recipient_id));
create policy "profile shares: owner revokes" on public.profile_shares
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Table privileges: signed-in people only, and only what the policies allow.
revoke all on public.profiles, public.public_keys, public.connections, public.connection_keys,
  public.invites, public.guest_submissions, public.intakes, public.profile_shares from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.public_keys to authenticated;
grant select on public.connections to authenticated;
grant update (status) on public.connections to authenticated;
grant select, insert on public.connection_keys to authenticated;
grant select, insert, delete on public.invites to authenticated;
grant select on public.guest_submissions to authenticated;
grant select, insert, delete on public.intakes to authenticated;
grant select, insert, delete on public.profile_shares to authenticated;

-- Invite codes are made by the server, never chosen by the client.
-- The server also stamps the creation time, so expiry can't be stretched.
create or replace function public.set_invite_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.code := public.random_code(case when new.kind = 'guest' then 24 else 8 end);
  new.created_at := now();
  if new.expires_at > new.created_at + interval '30 days' then
    raise exception 'Invites last at most 30 days';
  end if;
  return new;
end;
$$;

create trigger invites_set_code
  before insert on public.invites
  for each row execute function public.set_invite_code();

-- Intake versions count up per owner, set by the server.
create or replace function public.set_intake_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(version), 0) + 1 into new.version from public.intakes where owner_id = new.owner_id;
  return new;
end;
$$;

create trigger intakes_set_version
  before insert on public.intakes
  for each row execute function public.set_intake_version();

-- Invite functions ----------------------------------------------------------

-- Look up an invite by its code. Returns only what the invitee needs to see.
create or replace function public.get_invite(invite_code text)
returns table (
  kind text,
  inviter_role text,
  suggested_path text,
  sealed_note text,
  inviter_public_key text,
  expired boolean,
  used boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.kind, i.inviter_role, i.suggested_path, i.sealed_note, k.public_key,
         i.expires_at < now(), i.used_at is not null
  from public.invites i
  left join public.public_keys k on k.user_id = i.created_by
  where i.code = upper(invite_code);
$$;

-- Accept an account invite: creates the connection, then the invite is spent.
create or replace function public.accept_invite(invite_code text)
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

  insert into public.connections (top_id, bottom_id)
  values (
    case when inv.inviter_role = 'top' then inv.created_by else me end,
    case when inv.inviter_role = 'top' then me else inv.created_by end
  )
  on conflict (top_id, bottom_id) do update set status = 'active'
  returning id into conn;

  update public.invites set used_at = now(), used_by = me where id = inv.id;
  return conn;
end;
$$;

-- A guest (no account) sends their sealed answers once, through the link.
create or replace function public.submit_guest(invite_code text, payload text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv from public.invites where code = upper(invite_code) for update;
  if not found or inv.kind <> 'guest' then
    raise exception 'This link was not found';
  end if;
  if inv.used_at is not null then
    raise exception 'This link has already been used';
  end if;
  if inv.expires_at < now() then
    raise exception 'This link has expired';
  end if;
  if payload is null or char_length(payload) = 0 or char_length(payload) > 512000 then
    raise exception 'Those answers could not be saved';
  end if;

  insert into public.guest_submissions (invite_id, sealed_payload) values (inv.id, payload);
  update public.invites set used_at = now() where id = inv.id;
end;
$$;

revoke all on function public.is_connected(uuid, uuid), public.is_member(uuid, uuid), public.random_code(integer),
  public.get_invite(text), public.accept_invite(text), public.submit_guest(text, text),
  public.set_invite_code(), public.set_intake_version() from public, anon, authenticated;
grant execute on function public.is_connected(uuid, uuid), public.is_member(uuid, uuid) to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.submit_guest(text, text) to anon, authenticated;
