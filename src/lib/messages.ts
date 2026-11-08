import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import { readJson, writeJson } from './storage';
import { partnerKey } from './vibes';

// Direct messages between connected people (M7). Each message is sealed to the
// recipient, with a copy sealed to the sender, on the sender's phone. The
// server sees who wrote to whom and when, never the words.

export interface MessageBody {
  text: string;
  /** A check-in sent from the after-scene check-in screen. */
  kind?: 'text' | 'checkin';
}

export interface Message extends MessageBody {
  id: string;
  mine: boolean;
  at: string;
  readAt: string | null;
}

export const MAX_MESSAGE = 2000;

export async function sendMessage(keys: StoredKeys, connectionId: string, toId: string, body: MessageBody): Promise<void> {
  const text = body.text.trim().slice(0, MAX_MESSAGE);
  if (!text) return;
  const json = JSON.stringify({ ...body, text });
  const { error } = await db.from('messages').insert({
    connection_id: connectionId,
    recipient_id: toId,
    sealed_for_recipient: await sealFor(json, await partnerKey(toId)),
    sealed_for_sender: await sealFor(json, keys.publicKey)
  });
  if (error) throw new AccountError("Ember couldn't send that. Check your connection and try again.");
}

/** The thread with one connection, oldest first, after any history you cleared on this phone. */
export async function listThread(keys: StoredKeys, connectionId: string): Promise<Message[]> {
  const { data, error } = await db
    .from('messages')
    .select('id, sender_id, sealed_for_recipient, sealed_for_sender, created_at, read_at')
    .eq('connection_id', connectionId)
    .order('created_at');
  if (error) throw new AccountError("Ember couldn't load your messages.");
  const cleared = clearedAt(connectionId);
  const out: Message[] = [];
  for (const r of data ?? []) {
    if (cleared && r.created_at <= cleared) continue;
    const mine = r.sender_id === keys.userId;
    const body = await openSealed(mine ? r.sealed_for_sender : r.sealed_for_recipient, keys)
      .then((t) => JSON.parse(t) as MessageBody)
      .catch(() => null);
    if (!body) continue;
    out.push({ ...body, id: r.id, mine, at: r.created_at, readAt: r.read_at });
  }
  return out;
}

/** Unread counts by connection, for badges. */
export async function unreadCounts(keys: StoredKeys): Promise<Record<string, number>> {
  const { data } = await db.from('messages').select('connection_id, created_at').eq('recipient_id', keys.userId).is('read_at', null);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const cleared = clearedAt(r.connection_id);
    if (cleared && r.created_at <= cleared) continue;
    counts[r.connection_id] = (counts[r.connection_id] ?? 0) + 1;
  }
  return counts;
}

export async function markRead(keys: StoredKeys, connectionId: string): Promise<void> {
  await db.from('messages').update({ read_at: new Date().toISOString() }).eq('connection_id', connectionId).eq('recipient_id', keys.userId).is('read_at', null);
}

/** Takes back a message you sent, for both of you. */
export async function unsend(id: string): Promise<void> {
  const { error } = await db.from('messages').delete().eq('id', id);
  if (error) throw new AccountError("Ember couldn't remove that. Please try again.");
}

// Clearing history on this phone only ---------------------------------------------

const CLEARED = 'ember.clearedThreads';

function clearedAt(connectionId: string): string | null {
  return readJson<Record<string, string>>(CLEARED)?.[connectionId] ?? null;
}

/** Hides everything up to now in this thread, on this phone. The other person keeps their copy. */
export function clearHistory(connectionId: string): void {
  writeJson(CLEARED, { ...(readJson<Record<string, string>>(CLEARED) ?? {}), [connectionId]: new Date().toISOString() });
}

// Block and report -----------------------------------------------------------------

export async function isBlocked(otherId: string): Promise<boolean> {
  const { data } = await db.from('blocks').select('blocked_id').eq('blocked_id', otherId).maybeSingle();
  return Boolean(data);
}

/** Their messages stop reaching you. They aren't told. */
export async function block(keys: StoredKeys, otherId: string): Promise<void> {
  const { error } = await db.from('blocks').upsert({ blocker_id: keys.userId, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw new AccountError("Ember couldn't block them. Please try again.");
}

export async function unblock(keys: StoredKeys, otherId: string): Promise<void> {
  await db.from('blocks').delete().eq('blocker_id', keys.userId).eq('blocked_id', otherId);
}

export const reportReasons = [
  { id: 'harassment', label: 'Harassment or pressure' },
  { id: 'threats', label: 'Threats or safety concerns' },
  { id: 'consent', label: 'Ignoring consent or limits' },
  { id: 'spam', label: 'Spam or scams' },
  { id: 'underage', label: 'May be under 18' },
  { id: 'other', label: 'Something else' }
] as const;
export type ReportReason = (typeof reportReasons)[number]['id'];

/**
 * Reports someone to Ember and blocks them. The messages you choose are
 * included as readable text, so Ember can review them; nothing else is.
 */
export async function report(keys: StoredKeys, otherId: string, reason: ReportReason, details: string, included: Message[]): Promise<void> {
  const text = included.map((m) => `[${m.at}] ${m.mine ? 'Reporter' : 'Reported'}: ${m.text}`).join('\n').slice(0, 8000);
  const { error } = await db.from('reports').insert({ reported_id: otherId, reason, details: details.trim().slice(0, 1000) || null, included_text: text || null });
  if (error) throw new AccountError("Ember couldn't send the report. Please try again.");
  await block(keys, otherId);
}
