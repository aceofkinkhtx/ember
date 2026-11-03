-- M1: ending a connection.
-- Either person can end a connection. Ending is final for both: neither can
-- reopen it alone, only a new invite that the other person accepts brings it
-- back. Ending also withdraws every profile share between the two people.
-- Pausing gives one person space: only the person who paused can resume.

alter table public.connections add column if not exists paused_by uuid references auth.users (id) on delete set null;

create or replace function public.guard_connection_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only accept_invite (a new invite the other person accepted) may reopen.
  -- People can't set this marker: they have no way to run set_config.
  if old.status = 'ended' and new.status <> 'ended'
     and coalesce(current_setting('ember.reopening_by_invite', true), '') <> 'on' then
    raise exception 'This connection has ended. Send a new invite to reconnect.';
  end if;

  if old.status = 'paused' and new.status = 'active'
     and old.paused_by is distinct from (select auth.uid())
     and coalesce(current_setting('ember.reopening_by_invite', true), '') <> 'on' then
    raise exception 'Only the person who paused this connection can resume it.';
  end if;

  new.paused_by := case when new.status = 'paused' then coalesce(old.paused_by, (select auth.uid())) else null end;

  if new.status = 'ended' and old.status <> 'ended' then
    delete from public.profile_shares
    where (owner_id = new.top_id and recipient_id = new.bottom_id)
       or (owner_id = new.bottom_id and recipient_id = new.top_id);
  end if;
  return new;
end;
$$;

drop trigger if exists guard_connection_status on public.connections;
create trigger guard_connection_status
  before update of status on public.connections
  for each row execute function public.guard_connection_status();

revoke all on function public.guard_connection_status() from public, anon, authenticated;

-- accept_invite, unchanged except for the marker above the insert.
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

  -- Lets the status guard know this reopening comes from an accepted invite.
  perform set_config('ember.reopening_by_invite', 'on', true);

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

