import type { Settings } from '../state/settings';
import { AccountError, cardFor, db, listConnections, signOut, type StoredKeys } from './account';
import { AVATAR_BUCKET } from './avatar';
import { openSealed } from './crypto';
import { listVersions } from './intake';
import { listThread } from './messages';
import { listScenes } from './scenes';
import { BUCKET as GEAR_BUCKET, listMyToys, loadToyRing, photoUrl } from './toys';
import { eraseAll } from './storage';

// M9: your data. Export unlocks everything you can read on this phone and
// saves it as one file; nothing leaves the phone. Deleting your account
// removes your photo files, then the account and every row that belongs to it.

export const EXPORT_VERSION = 1;

/** Settings worth exporting: everything except the PIN's hash and lock details. */
export function exportableSettings(s: Settings): Omit<Settings, 'pin' | 'biometric'> & { pin: boolean } {
  const { pin, biometric: _b, ...rest } = s;
  void _b;
  return { ...rest, pin: Boolean(pin) };
}

async function dataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Collects everything you can read into one object. `onStep` reports progress in words. */
export async function collectMyData(keys: StoredKeys, settings: Settings, onStep: (step: string) => void = () => {}) {
  const { data: user } = await db.auth.getUser();

  onStep('Your profile');
  const profiles = await listVersions(keys).catch(() => []);

  onStep('Your gear');
  const ring = loadToyRing();
  const toys = await listMyToys(keys).catch(() => []);
  const gear = [];
  for (const t of toys) {
    const url = ring ? await photoUrl(t, ring.gens).catch(() => null) : null;
    gear.push({ ...t, photo: url ? await dataUrl(url) : null });
  }

  onStep('Your scenes');
  const scenes = await listScenes(keys).catch(() => []);

  onStep('Your connections and messages');
  const conns = await listConnections(keys, cardFor(settings.identity)).catch(() => []);
  const connections = [];
  for (const c of conns) {
    const messages = await listThread(keys, c.id).catch(() => []);
    connections.push({
      name: c.them?.name ?? null,
      pronouns: c.them?.pronouns ?? null,
      yourRole: c.myRole,
      theirRole: c.theirRole,
      status: c.status,
      since: c.since,
      messages: messages.map((m) => ({ from: m.mine ? 'you' : 'them', at: m.at, kind: m.kind ?? 'text', text: m.text }))
    });
  }

  onStep('Your check-ins and debriefs');
  const { data: notes } = await db.from('scene_notes').select('kind, day, created_at, sealed_self').eq('author_id', keys.userId).order('created_at');
  const afterScene = [];
  for (const n of notes ?? []) {
    const body = await openSealed(n.sealed_self, keys)
      .then((t) => JSON.parse(t) as unknown)
      .catch(() => null);
    if (body) afterScene.push({ kind: n.kind, day: n.day, at: n.created_at, answers: body });
  }

  return {
    about: 'Everything Ember could unlock for you on this phone. Keep this file somewhere private: it is not locked.',
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    account: { id: keys.userId, email: user.user?.email ?? null },
    onThisPhone: exportableSettings(settings),
    profiles,
    gear,
    scenes,
    connections,
    afterScene
  };
}

/** Saves the export as a file on this phone. */
export function saveFile(data: unknown, name: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const exportFileName = (date = new Date()) => `ember-my-data-${date.toISOString().slice(0, 10)}.json`;

/** Removes every file in your folder of a storage bucket. */
async function removeMyFiles(bucket: string, userId: string): Promise<void> {
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(userId, { limit: 100 });
    if (error) throw new AccountError("Ember couldn't remove your photos. Nothing was deleted. Please try again.");
    const files = (data ?? []).filter((f) => f.name && f.id);
    if (!files.length) return;
    const { error: removeError } = await db.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
    if (removeError) throw new AccountError("Ember couldn't remove your photos. Nothing was deleted. Please try again.");
  }
}

/** Deletes your account and everything in it, then clears this phone. */
export async function deleteMyAccount(keys: StoredKeys): Promise<void> {
  await removeMyFiles(GEAR_BUCKET, keys.userId);
  await removeMyFiles(AVATAR_BUCKET, keys.userId);
  const { error } = await db.rpc('delete_my_account');
  if (error) throw new AccountError("Ember couldn't delete your account. Please try again.");
  await signOut().catch(() => {});
  eraseAll();
}
