-- "Not for me" on a partner's gear (Michael, Nov 16).
--
-- Until now only a toy's owner could keep it out of scenes with one
-- connection. Now the other person in that connection can too, for any of the
-- owner's gear shared with them. Each opt-out remembers who set it, and only
-- that person can clear it: the owner can't undo the partner's "Not for me".
-- The scene rules already block any opted-out gear on the connection.

alter table public.toy_opt_outs add column set_by uuid references auth.users (id) on delete cascade;

-- Every opt-out so far was set by the toy's owner.
update public.toy_opt_outs o set set_by = t.owner_id from public.toys t where t.id = o.toy_id;

alter table public.toy_opt_outs
  alter column set_by set not null,
  alter column set_by set default auth.uid(),
  drop constraint toy_opt_outs_pkey,
  add primary key (connection_id, toy_id, set_by);

drop policy "toy opt-outs: owner sets" on public.toy_opt_outs;
drop policy "toy opt-outs: owner clears" on public.toy_opt_outs;

-- Set by yourself, in a connection you're in, on your own toy or on one the
-- owner (the other person in that connection) shares with you.
create policy "toy opt-outs: owner or partner sets" on public.toy_opt_outs
  for insert to authenticated
  with check (
    set_by = (select auth.uid())
    and public.is_member(connection_id, (select auth.uid()))
    and exists (
      select 1
      from public.toys t
      join public.connections c on c.id = connection_id
      where t.id = toy_id
        and (t.owner_id = c.user_a or t.owner_id = c.user_b)
        and (
          t.owner_id = (select auth.uid())
          or exists (
            select 1 from public.toy_shares s
            where s.owner_id = t.owner_id and s.recipient_id = (select auth.uid())
          )
        )
    )
  );

create policy "toy opt-outs: only who set it clears" on public.toy_opt_outs
  for delete to authenticated
  using (set_by = (select auth.uid()));
