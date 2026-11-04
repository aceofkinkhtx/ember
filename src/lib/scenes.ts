import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import type { DesignRequest } from './scene/designer';
import type { Scene } from './scene/model';
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
