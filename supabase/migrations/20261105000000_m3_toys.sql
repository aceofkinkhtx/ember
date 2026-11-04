-- M3: toy collections.
--
-- Anyone can keep toys, whatever their role. Each toy's details and photo are
-- locked on the owner's phone with the owner's toy key; the server stores only
-- locked boxes. Within a connection, each person can share their collection:
-- toy_shares holds the toy keys locked for that one connection. A toy's owner
-- can also keep a toy out of scenes with one connection (toy_opt_outs).

create table public.toys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sealed_toy text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index toys_owner on public.toys (owner_id);

create table public.toy_shares (
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  wrapped_toy_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, recipient_id),
  check (owner_id <> recipient_id)
);

create table public.toy_opt_outs (
  connection_id uuid not null references public.connections (id) on delete cascade,
  toy_id uuid not null references public.toys (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (connection_id, toy_id)
);

alter table public.toys enable row level security;
alter table public.toy_shares enable row level security;
alter table public.toy_opt_outs enable row level security;

-- Toys: the owner, and connections the owner shares with.
create policy "toys: owner and shared connections read" on public.toys
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (
      exists (
        select 1 from public.toy_shares s
        where s.owner_id = toys.owner_id and s.recipient_id = (select auth.uid())
      )
      and public.is_connected(owner_id, (select auth.uid()))
    )
  );
create policy "toys: owner creates" on public.toys
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "toys: owner edits" on public.toys
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "toys: owner deletes" on public.toys
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Toy shares: the owner grants and revokes; the recipient can read theirs.
create policy "toy shares: owner and recipient read" on public.toy_shares
  for select to authenticated
  using ((select auth.uid()) in (owner_id, recipient_id));
create policy "toy shares: owner grants to a connection" on public.toy_shares
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_connected(owner_id, recipient_id));
create policy "toy shares: owner revokes" on public.toy_shares
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Opt-outs: both people in the connection can see them; only the toy's owner,
-- as a member of that connection, sets or clears one.
create policy "toy opt-outs: members read" on public.toy_opt_outs
  for select to authenticated
  using (public.is_member(connection_id, (select auth.uid())));
create policy "toy opt-outs: owner sets" on public.toy_opt_outs
  for insert to authenticated
  with check (
    public.is_member(connection_id, (select auth.uid()))
    and exists (select 1 from public.toys t where t.id = toy_id and t.owner_id = (select auth.uid()))
  );
create policy "toy opt-outs: owner clears" on public.toy_opt_outs
  for delete to authenticated
  using (exists (select 1 from public.toys t where t.id = toy_id and t.owner_id = (select auth.uid())));

revoke all on public.toys, public.toy_shares, public.toy_opt_outs from anon, authenticated;
grant select, insert, delete on public.toys to authenticated;
grant update (sealed_toy, updated_at) on public.toys to authenticated;
grant select, insert, delete on public.toy_shares to authenticated;
grant select, insert, delete on public.toy_opt_outs to authenticated;

-- Ending a connection also stops toy sharing both ways --------------------------

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
  end if;
  return new;
end;
$$;

-- Toy photos ---------------------------------------------------------------------
-- Each photo is shrunk, stripped of location and camera details, and locked on
-- the phone before upload, so the bucket holds only locked bytes. Files live at
-- <owner id>/<toy id>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toy-photos', 'toy-photos', false, 1048576, array['application/octet-stream'])
on conflict (id) do nothing;

create policy "toy photos: owner and shared connections read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'toy-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.toy_shares s
        where s.owner_id::text = (storage.foldername(name))[1]
          and s.recipient_id = (select auth.uid())
          and public.is_connected(s.owner_id, (select auth.uid()))
      )
    )
  );
create policy "toy photos: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'toy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "toy photos: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'toy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'toy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "toy photos: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'toy-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
