import { AccountError, db } from './account';
import { vapidPublicKey } from './pushConfig';

// Phone alerts (M7, approved by Michael on Nov 7). The alert text is always
// generic ("A check-in is waiting in Ember"); the check-in itself stays in
// the app. Alerts pass through the phone maker's push service (Apple, Google
// or Mozilla), which sees only that an alert went to this phone.

export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !installed() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Asks for permission (from a tap), subscribes this phone and saves what it wants alerts for. */
export async function turnOnPush(wants: { checkins: boolean; messages: boolean }): Promise<PushState> {
  if (!supported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
  const json = sub.toJSON();
  const { error } = await db.from('push_subscriptions').upsert(
    { endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, wants_checkins: wants.checkins, wants_messages: wants.messages },
    { onConflict: 'endpoint' }
  );
  if (error) throw new AccountError("Ember couldn't turn on alerts. Please try again.");
  return 'on';
}

/** Updates what this phone wants alerts for, if it's signed up. */
export async function setPushWants(wants: { checkins: boolean; messages: boolean }): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  if (!wants.checkins && !wants.messages) return turnOffPush();
  await db.from('push_subscriptions').update({ wants_checkins: wants.checkins, wants_messages: wants.messages }).eq('endpoint', sub.endpoint);
}

export async function turnOffPush(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
