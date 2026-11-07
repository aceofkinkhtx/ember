import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import type { BottomCheck, BottomSignal, CheckAsk, LiveShare, LiveState } from './scene/live';
import type { Scene } from './scene/model';
import { liveShare } from './scene/live';
import { partnerKey } from './vibes';

// Live Scene Mode between two phones (M6). Everything rides on the SceneVibe
// the Top shared and is sealed on the sender's phone: the check and the scene
// clock to the bottom, the bottom's answers and signals to the Top.

const LIVE = 'ember.live';

// The Top's side -------------------------------------------------------------

/** Asks the bottom for their part of the pre-scene check, maybes included. */
export async function sendCheck(shareId: string, partnerId: string, ask: CheckAsk): Promise<void> {
  const sealed = await sealFor(JSON.stringify(ask), await partnerKey(partnerId));
  const { error } = await db.from('scene_vibes').update({ sealed_check: sealed }).eq('id', shareId);
  if (error) throw new AccountError("Ember couldn't send the check. Please try again.");
}

export interface FromBottom {
  answer: BottomCheck | null;
  signal: BottomSignal | null;
  changedAt: string;
}

/** The bottom's answers and any signal from their phone. Null when offline. */
export async function readFromBottom(keys: StoredKeys, shareId: string): Promise<FromBottom | null> {
  const { data, error } = await db.from('scene_vibes').select('sealed_answer, sealed_signal, updated_at').eq('id', shareId).maybeSingle();
  if (error || !data) return null;
  const open = async <T,>(t: string | null) => (t ? openSealed(t, keys).then((x) => JSON.parse(x) as T).catch(() => null) : null);
  return { answer: await open<BottomCheck>(data.sealed_answer), signal: await open<BottomSignal>(data.sealed_signal), changedAt: data.updated_at };
}

/** Tells the bottom's phone where the clock is. Fails quietly offline. */
export async function sendLive(shareId: string, partnerId: string, live: LiveState, scene?: Scene): Promise<boolean> {
  try {
    const sealed = await sealFor(JSON.stringify(liveShare(live, scene)), await partnerKey(partnerId));
    const { error } = await db.from('scene_vibes').update({ sealed_live: sealed }).eq('id', shareId);
    return !error;
  } catch {
    return false;
  }
}

/** The running scene kept on this phone, so the guide works offline. */
export function keepLocally(scene: Scene): void {
  try {
    window.localStorage.setItem(LIVE, JSON.stringify(scene));
  } catch {
    // Storage full or blocked: the scene still runs from memory.
  }
}

export function readLocal(sceneId: string): Scene | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LIVE) ?? 'null') as Scene | null;
    return saved?.id === sceneId ? saved : null;
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  window.localStorage.removeItem(LIVE);
}

// The bottom's side ------------------------------------------------------------

export async function answerCheck(shareId: string, topId: string, answer: BottomCheck): Promise<void> {
  const sealed = await sealFor(JSON.stringify(answer), await partnerKey(topId));
  const { error } = await db.from('scene_vibes').update({ sealed_answer: sealed }).eq('id', shareId);
  if (error) throw new AccountError("Ember couldn't send your answers. Please try again.");
}

export async function sendSignal(shareId: string, topId: string, signal: BottomSignal): Promise<void> {
  const sealed = await sealFor(JSON.stringify(signal), await partnerKey(topId));
  const { error } = await db.from('scene_vibes').update({ sealed_signal: sealed }).eq('id', shareId);
  if (error) throw new AccountError("That didn't reach your Top's phone. Say your signal out loud.");
}

/** The scene clock from the Top's phone. */
export async function readLive(keys: StoredKeys, shareId: string): Promise<LiveShare | null> {
  const { data } = await db.from('scene_vibes').select('sealed_live').eq('id', shareId).maybeSingle();
  if (!data?.sealed_live) return null;
  return openSealed(data.sealed_live, keys)
    .then((x) => JSON.parse(x) as LiveShare)
    .catch(() => null);
}
