import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import type { DesignRequest } from './scene/designer';
import type { RequestStatus, Scene } from './scene/model';
import { readJson, writeJson } from './storage';

// Saved scene designs (M4). Each design is sealed to the designer's own key
// before upload, so the server never sees what's in it, or who it's with.

export async function listScenes(keys: StoredKeys): Promise<Scene[]> {
  const { data, error } = await db.from('scenes').select('id, sealed_scene, updated_at').eq('owner_id', keys.userId);
  if (error) throw new AccountError("Ember couldn't load your scenes.");
  const out: Scene[] = [];
  for (const row of data ?? []) {
    const scene = await openSealed(row.sealed_scene, keys)
      .then((t) => JSON.parse(t) as Scene)
      .catch(() => null);
    if (scene) out.push({ ...scene, id: row.id });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveScene(keys: StoredKeys, scene: Scene): Promise<Scene> {
  const saved: Scene = { ...scene, updatedAt: new Date().toISOString() };
  const sealed = await sealFor(JSON.stringify(saved), keys.publicKey);
  const updated = await db.from('scenes').update({ sealed_scene: sealed, updated_at: saved.updatedAt }).eq('id', saved.id).select('id');
  if (updated.error) throw new AccountError("Ember couldn't save this scene. Please try again.");
  if (!updated.data?.length) {
    const { error } = await db.from('scenes').insert({ id: saved.id, owner_id: keys.userId, sealed_scene: sealed });
    if (error) throw new AccountError("Ember couldn't save this scene. Please try again.");
  }
  return saved;
}

export async function deleteScene(id: string): Promise<void> {
  // A SceneVibe shared from this scene goes with it.
  await db.from('scene_vibes').delete().eq('scene_ref', id);
  const { error } = await db.from('scenes').delete().eq('id', id);
  if (error) throw new AccountError("Ember couldn't delete this scene.");
}

/** A copy for reuse: a new id, out of the library, not yet tied to a date. */
export function copyScene(scene: Scene): Scene {
  const now = new Date().toISOString();
  return { ...structuredClone(scene), id: crypto.randomUUID(), title: `${scene.title} (copy)`, inLibrary: false, createdAt: now, updatedAt: now };
}

// The scene being set up, kept on this phone between the setup screens.
// Cleared at sign-out, like the intake draft.

export const SCENE_DRAFT = 'ember.sceneDraft';

export interface SceneDraft {
  request: DesignRequest;
}

export const loadSceneDraft = () => readJson<SceneDraft>(SCENE_DRAFT);
export const saveSceneDraft = (draft: SceneDraft) => writeJson(SCENE_DRAFT, draft);
export function clearSceneDraft(): void {
  try {
    window.localStorage.removeItem(SCENE_DRAFT);
  } catch {
    // Storage unavailable: nothing was saved.
  }
}

// Requests ------------------------------------------------------------------------
// A design one person makes for the other. It is sealed to the recipient's key
// on the sender's phone; the server sees only who, when and the answer.

export interface IncomingRequest {
  id: string;
  fromId: string;
  sentAt: string;
  scene: Scene;
}

/** Sends a design to the partner, and marks your own copy as sent. */
export async function sendSceneRequest(keys: StoredKeys, scene: Scene): Promise<Scene> {
  if (!scene.partnerId) throw new AccountError('Choose who this scene is for first.');
  const { data: pk } = await db.from('public_keys').select('public_key').eq('user_id', scene.partnerId).single();
  if (!pk) throw new AccountError('Ember can only send this to someone you are connected to.');
  // A design sent again replaces the earlier request.
  if (scene.request) await db.from('scene_requests').delete().eq('id', scene.request.id);
  const sealed = await sealFor(JSON.stringify(scene), pk.public_key);
  const { data, error } = await db.from('scene_requests').insert({ to_id: scene.partnerId, sealed_scene: sealed }).select('id, created_at').single();
  if (error || !data) throw new AccountError("Ember couldn't send this. Please try again.");
  return saveScene(keys, { ...scene, request: { id: data.id, sentAt: data.created_at, status: 'sent' } });
}

/** Designs your connections sent you that you haven't answered yet. */
export async function listIncomingRequests(keys: StoredKeys): Promise<IncomingRequest[]> {
  const { data, error } = await db.from('scene_requests').select('id, from_id, sealed_scene, created_at').eq('to_id', keys.userId).eq('status', 'sent');
  if (error) throw new AccountError("Ember couldn't load scene requests.");
  const out: IncomingRequest[] = [];
  for (const row of data ?? []) {
    const scene = await openSealed(row.sealed_scene, keys)
      .then((t) => JSON.parse(t) as Scene)
      .catch(() => null);
    if (scene) out.push({ id: row.id, fromId: row.from_id, sentAt: row.created_at, scene });
  }
  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/** The answers to requests you sent, by request id. */
export async function sentRequestStatuses(keys: StoredKeys): Promise<Record<string, RequestStatus>> {
  const { data } = await db.from('scene_requests').select('id, status').eq('from_id', keys.userId);
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, r.status]));
}

/** Saves your own copy of a request and tells the sender it was accepted. */
export async function acceptSceneRequest(keys: StoredKeys, request: IncomingRequest, mine: Scene): Promise<Scene> {
  const saved = await saveScene(keys, mine);
  const { error } = await db.from('scene_requests').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', request.id);
  if (error) throw new AccountError("Ember saved your copy but couldn't tell them. Please try again.");
  return saved;
}

export async function declineSceneRequest(id: string): Promise<void> {
  const { error } = await db.from('scene_requests').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new AccountError("Ember couldn't answer that request. Please try again.");
}

/** Takes back a request you sent. */
export async function withdrawSceneRequest(keys: StoredKeys, scene: Scene): Promise<Scene> {
  if (scene.request) await db.from('scene_requests').delete().eq('id', scene.request.id);
  return saveScene(keys, { ...scene, request: undefined });
}
