-- Scene request alerts get their own checkbox in Me (Michael, Nov 27). They
-- used to follow the "Messages and scene requests" switch. On by default, like
-- every alert.
alter table public.push_subscriptions
  add column wants_requests boolean not null default true;

-- Phones that had messages off keep scene request alerts off too, as before.
update public.push_subscriptions set wants_requests = wants_messages;
