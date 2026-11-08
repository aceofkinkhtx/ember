import type { BottomReply, TopReaction } from '../content/afterScene';
import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import { partnerKey } from './vibes';

// After the scene (M7). Every note is sealed on the phone: a copy for the
// author, and an optional part sealed to the other person for what is shared
// with them. The server keeps only who, when and what kind.

export type NoteKind = 'post' | 'debrief' | 'followup';

export interface PostNote {
  feeling: number | null;
  attentiveness: number | null;
  overall: number | null;
}

export interface TopDebrief {
  scores: Record<string, number | null>;
  notes: Record<string, string>;
  /** What the Top noticed, per activity. */
  reactions: Record<string, TopReaction>;
  observations: string;
}

export interface BottomDebrief {
  scores: Record<string, number | null>;
  differed: string;
  keep: string;
  replies: Record<string, BottomReply>;
}

export interface FollowUp {
  feeling: number | null;
  changed: boolean | null;
  changedNote: string;
  notes: string;
}

/** What the Top shares after the scene: the activities in it, for the bottom's debrief. */
export interface ActivityRef {
  id: string;
  label: string;
}

export interface Note<T = unknown> {
  id: string;
  vibeId: string;
  authorId: string;
  kind: NoteKind;
  day: number;
  createdAt: string;
  /** The author's own copy; only on your own notes. */
  mine: T | null;
  /** The part shared with the other person. */
  shared: Record<string, unknown> | null;
}

/** Schedules the check-ins for both people, once the scene ends. Safe to repeat. */
export async function scheduleAfterScene(vibeId: string): Promise<void> {
  const { error } = await db.rpc('schedule_after_scene', { vibe: vibeId });
  if (error) throw new AccountError("Ember couldn't schedule the check-ins. Please try again.");
}

/** Saves (or replaces) a note. `shared` is sealed to the other person; null keeps it all private. */
export async function saveNote(
  keys: StoredKeys,
  vibeId: string,
  partnerId: string,
  kind: NoteKind,
  day: number,
  mine: unknown,
  shared: Record<string, unknown> | null
): Promise<void> {
  const row = {
    vibe_id: vibeId,
    recipient_id: partnerId,
    kind,
    day,
    sealed_self: await sealFor(JSON.stringify(mine), keys.publicKey),
    sealed_shared: shared ? await sealFor(JSON.stringify(shared), await partnerKey(partnerId)) : null
  };
  const { data: existing } = await db.from('scene_notes').select('id').eq('vibe_id', vibeId).eq('author_id', keys.userId).eq('kind', kind).eq('day', day).maybeSingle();
  const { error } = existing
    ? await db.from('scene_notes').update({ sealed_self: row.sealed_self, sealed_shared: row.sealed_shared, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('scene_notes').insert(row);
  if (error) throw new AccountError("Ember couldn't save that. Please try again.");
}

/** Every note for a scene: yours (both parts) and theirs (the shared part only). */
export async function listNotes(keys: StoredKeys, vibeId: string): Promise<Note[]> {
  const { data, error } = await db.from('scene_notes').select('id, vibe_id, author_id, kind, day, created_at, sealed_self, sealed_shared').eq('vibe_id', vibeId);
  if (error) throw new AccountError("Ember couldn't load the check-ins.");
  const open = (t: string | null) => (t ? openSealed(t, keys).then((x) => JSON.parse(x)).catch(() => null) : Promise.resolve(null));
  return Promise.all(
    (data ?? []).map(async (r) => {
      const mineToo = r.author_id === keys.userId;
      return {
        id: r.id,
        vibeId: r.vibe_id,
        authorId: r.author_id,
        kind: r.kind as NoteKind,
        day: r.day,
        createdAt: r.created_at,
        mine: mineToo ? await open(r.sealed_self) : null,
        // Your own shared part is sealed to them, so only theirs opens here.
        shared: mineToo ? null : await open(r.sealed_shared)
      };
    })
  );
}

export const find = <T,>(notes: Note[], by: string, kind: NoteKind, day = 0): Note<T> | undefined =>
  notes.find((n) => n.authorId === by && n.kind === kind && n.day === day) as Note<T> | undefined;

// Reminders -------------------------------------------------------------------

export type ReminderKind = 'post' | 'debrief' | 'followup' | 'checkin' | 'message';

export interface Reminder {
  id: string;
  vibeId: string | null;
  kind: ReminderKind;
  day: number;
  dueAt: string;
  doneAt: string | null;
}

/** Your reminders: what is due now, and what is coming. */
export async function listReminders(): Promise<Reminder[]> {
  const { data, error } = await db.from('reminders').select('id, vibe_id, kind, day, due_at, done_at').order('due_at');
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id, vibeId: r.vibe_id, kind: r.kind as ReminderKind, day: r.day, dueAt: r.due_at, doneAt: r.done_at }));
}

/** Check-ins due now and not done yet, allowing a minute of clock difference with the server. Message alerts are counted elsewhere. */
export function dueNow(all: Reminder[], now = Date.now()): Reminder[] {
  return all.filter((r) => r.kind !== 'message' && !r.doneAt && Date.parse(r.dueAt) <= now + 60_000);
}

export async function markDone(vibeId: string, kind: ReminderKind, day = 0): Promise<void> {
  await db.from('reminders').update({ done_at: new Date().toISOString() }).eq('vibe_id', vibeId).eq('kind', kind).eq('day', day).is('done_at', null);
}

export async function markMessagesSeen(): Promise<void> {
  await db.from('reminders').update({ done_at: new Date().toISOString() }).eq('kind', 'message').is('done_at', null);
}

/** The Top and bottom of a shared scene, from your side. */
export async function scenePeople(keys: StoredKeys, vibeId: string): Promise<{ amTop: boolean; partnerId: string } | null> {
  const { data } = await db.from('scene_vibes').select('owner_id, recipient_id').eq('id', vibeId).maybeSingle();
  if (!data) return null;
  const amTop = data.owner_id === keys.userId;
  return { amTop, partnerId: amTop ? data.recipient_id : data.owner_id };
}
