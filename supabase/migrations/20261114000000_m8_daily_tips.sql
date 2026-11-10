-- M8 Daily tips: a once-a-day phone alert at the time each person chooses.
--
-- The tips themselves live in the app and are chosen on the phone, so the
-- server never knows which tip anyone reads. The alert only ever says
-- "Your daily note is ready in Ember."
--
-- Each phone's alert settings gain:
--   wants_tips    whether this phone gets the daily alert
--   tip_minute    when, in minutes after midnight on the phone's clock
--   time_zone     the phone's time zone, so "9:00" means 9:00 where they are
--   last_tip_on   the local day the last alert went out, so it goes once a day

alter table public.push_subscriptions
  add column wants_tips boolean not null default true,
  add column tip_minute smallint not null default 540 check (tip_minute between 0 and 1439),
  add column time_zone text not null default 'UTC' check (length(time_zone) between 1 and 64),
  add column last_tip_on date;

-- A time zone the database doesn't know would stop the alert job, so it is
-- checked on the way in.
create or replace function public.check_push_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.time_zone;
  return new;
exception when others then
  raise exception 'Unknown time zone.';
end;
$$;

create trigger push_subscriptions_time_zone
  before insert or update of time_zone on public.push_subscriptions
  for each row execute function public.check_push_time_zone();

revoke all on function public.check_push_time_zone() from public, anon, authenticated;

-- Phones whose daily alert is due now: past their chosen time today, and not
-- yet sent today. Only the alert sender (service role) uses this.
create or replace function public.due_daily_tips()
returns setof public.push_subscriptions
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.push_subscriptions s
  where s.wants_tips
    and (s.last_tip_on is null or s.last_tip_on < (now() at time zone s.time_zone)::date)
    and extract(hour from (now() at time zone s.time_zone)) * 60
        + extract(minute from (now() at time zone s.time_zone)) >= s.tip_minute;
$$;

revoke all on function public.due_daily_tips() from public, anon, authenticated;
grant execute on function public.due_daily_tips() to service_role;

-- The 5-minute job now also runs when a daily alert is due.
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
  where (
    exists (
      select 1 from public.reminders
      where sent_at is null and due_at <= now() and due_at > now() - interval '2 days'
    )
    or exists (select 1 from public.due_daily_tips())
  )
  and exists (select 1 from vault.decrypted_secrets where name = 'ember_cron_secret');
  $job$
);
