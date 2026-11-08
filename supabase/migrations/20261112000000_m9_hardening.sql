-- M9 Hardening: delete my account, and keep reports when a reported account is deleted.

-- Deleting your account. Every table that holds your rows refers to your
-- account with "on delete cascade", so removing the account removes your
-- intakes, gear, scenes, SceneVibes, check-ins, messages, connections, codes,
-- invites, alert sign-ups and reminders. Photo files are removed by the app
-- first (storage files can't be deleted from SQL), while you can still reach
-- them.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- A report outlives the reported account, so deleting an account can't erase
-- reports made about it. The reporter's own reports still go with their account.
alter table public.reports drop constraint if exists reports_reported_id_fkey;
alter table public.reports alter column reported_id drop not null;
alter table public.reports
  add constraint reports_reported_id_fkey foreign key (reported_id) references auth.users (id) on delete set null;
