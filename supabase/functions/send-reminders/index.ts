// Sends Ember's phone alerts (M7). Called every 5 minutes by the database's
// scheduled job, only when an alert is due. The text is always generic and
// never names a person, a scene or an act; the check-in waits in the app.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const text = {
  checkin: 'A check-in is waiting in Ember.',
  message: 'You have a new message in Ember.'
};

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('Not allowed', { status: 401 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS')!), { extractable: false });
  const server = await webpush.ApplicationServer.new({ contactInformation: 'https://ember-50z.pages.dev', vapidKeys });

  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const { data: due, error } = await admin
    .from('reminders')
    .select('id, user_id, kind')
    .is('sent_at', null)
    .is('done_at', null)
    .lte('due_at', new Date().toISOString())
    .gt('due_at', since)
    .limit(500);
  if (error) return new Response('Could not read reminders', { status: 500 });
  if (!due?.length) return Response.json({ sent: 0 });

  // Mark them first, so a slow run never sends the same alert twice.
  await admin.from('reminders').update({ sent_at: new Date().toISOString() }).in('id', due.map((r) => r.id));

  const users = [...new Set(due.map((r) => r.user_id))];
  const { data: subs } = await admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, wants_checkins, wants_messages').in('user_id', users);

  let sent = 0;
  const gone: string[] = [];
  for (const user of users) {
    const mine = due.filter((r) => r.user_id === user);
    const checkins = mine.some((r) => r.kind !== 'message');
    const messages = mine.some((r) => r.kind === 'message');
    for (const s of (subs ?? []).filter((x) => x.user_id === user)) {
      // One alert per phone per run: a check-in outranks a message.
      const kind = checkins && s.wants_checkins ? 'checkin' : messages && s.wants_messages ? 'message' : null;
      if (!kind) continue;
      try {
        await server
          .subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
          .pushTextMessage(JSON.stringify({ body: text[kind], tag: kind, url: kind === 'message' ? '/connections' : '/' }), { ttl: 86400 });
        sent++;
      } catch (e) {
        const status = (e as { response?: Response })?.response?.status;
        if ((e as { isGone?: () => boolean })?.isGone?.() || status === 404 || status === 410) gone.push(s.id);
      }
    }
  }
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);
  return Response.json({ sent, removed: gone.length });
});
