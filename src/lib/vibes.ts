import type { PhaseType } from '../content/phases';
import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import type { Scene } from './scene/model';
import type { CheckAsk, LiveShare } from './scene/live';
import { planToSend, sceneVibe, type SceneVibe } from './scene/vibe';
import { saveScene } from './scenes';

// Sharing a SceneVibe with the bottom, and the plan request flow (M5). The
// SceneVibe and any plan are sealed to the bottom's key on the Top's phone.

export async function partnerKey(partnerId: string): Promise<string> {
  const { data } = await db.from('public_keys').select('public_key').eq('user_id', partnerId).single();
  if (!data) throw new AccountError('Ember can only share with someone you are connected to.');
  return data.public_key as string;
}

/** Shares (or updates) the SceneVibe with the scene's partner. */
export async function shareVibe(keys: StoredKeys, scene: Scene, colors: Partial<Record<PhaseType, string>>): Promise<Scene> {
  if (!scene.partnerId) throw new AccountError('Choose who this scene is with first.');
  const sealed = await sealFor(JSON.stringify(sceneVibe(scene, colors)), await partnerKey(scene.partnerId));
  if (scene.share) {
    const { data, error } = await db.from('scene_vibes').update({ sealed_vibe: sealed }).eq('id', scene.share.id).select('id');
    if (error) throw new AccountError("Ember couldn't update the SceneVibe. Please try again.");
    if (data?.length) return scene;
  }
  const { data, error } = await db
    .from('scene_vibes')
    .insert({ recipient_id: scene.partnerId, scene_ref: scene.id, sealed_vibe: sealed })
    .select('id, created_at')
    .single();
  if (error || !data) throw new AccountError("Ember couldn't share the SceneVibe. Please try again.");
  return saveScene(keys, { ...scene, share: { id: data.id, sharedAt: data.created_at } });
}

export async function stopSharingVibe(keys: StoredKeys, scene: Scene): Promise<Scene> {
  if (scene.share) await db.from('scene_vibes').delete().eq('id', scene.share.id);
  return saveScene(keys, { ...scene, share: undefined });
}

export interface PlanState {
  requestedAt: string | null;
  declinedAt: string | null;
  sent: boolean;
}

/** Whether the bottom asked for the plan, and how the Top answered. */
export function planStatus(p: PlanState): 'none' | 'requested' | 'sent' | 'declined' {
  if (p.sent) return 'sent';
  if (p.requestedAt && p.declinedAt && p.declinedAt >= p.requestedAt) return 'declined';
  if (p.requestedAt) return 'requested';
  return 'none';
}

export async function vibePlanState(scene: Scene): Promise<PlanState | null> {
  if (!scene.share) return null;
  const { data } = await db.from('scene_vibes').select('plan_requested_at, plan_declined_at, sealed_plan').eq('id', scene.share.id).maybeSingle();
  if (!data) return null;
  return { requestedAt: data.plan_requested_at, declinedAt: data.plan_declined_at, sent: Boolean(data.sealed_plan) };
}

/** Sends the full plan. Surprises stay hidden unless the Top reveals them. */
export async function sendPlan(scene: Scene, revealSurprises: boolean): Promise<void> {
  if (!scene.share || !scene.partnerId) throw new AccountError('Share the SceneVibe first.');
  const sealed = await sealFor(JSON.stringify(planToSend(scene, revealSurprises)), await partnerKey(scene.partnerId));
  const { error } = await db.from('scene_vibes').update({ sealed_plan: sealed, plan_declined_at: null }).eq('id', scene.share.id);
  if (error) throw new AccountError("Ember couldn't send the plan. Please try again.");
}

export async function declinePlan(scene: Scene): Promise<void> {
  if (!scene.share) return;
  const { error } = await db.from('scene_vibes').update({ plan_declined_at: new Date().toISOString() }).eq('id', scene.share.id);
  if (error) throw new AccountError("Ember couldn't answer. Please try again.");
}

// The bottom's side ------------------------------------------------------------

export interface SharedVibe extends PlanState {
  id: string;
  ownerId: string;
  vibe: SceneVibe;
  plan: Scene | null;
  /** M6: the pre-scene check the Top asked, whether it's answered, and the scene clock. */
  check: CheckAsk | null;
  answered: boolean;
  live: LiveShare | null;
}

export async function listSharedVibes(keys: StoredKeys): Promise<SharedVibe[]> {
  const { data, error } = await db
    .from('scene_vibes')
    .select('id, owner_id, sealed_vibe, sealed_plan, plan_requested_at, plan_declined_at, sealed_check, sealed_answer, sealed_live')
    .eq('recipient_id', keys.userId);
  if (error) throw new AccountError("Ember couldn't load your SceneVibes.");
  const out: SharedVibe[] = [];
  for (const row of data ?? []) {
    const vibe = await openSealed(row.sealed_vibe, keys)
      .then((t) => JSON.parse(t) as SceneVibe)
      .catch(() => null);
    if (!vibe) continue;
    const plan = row.sealed_plan
      ? await openSealed(row.sealed_plan, keys)
          .then((t) => JSON.parse(t) as Scene)
          .catch(() => null)
      : null;
    const open = <T,>(t: string | null) => (t ? openSealed(t, keys).then((x) => JSON.parse(x) as T).catch(() => null) : Promise.resolve(null));
    const [check, live] = await Promise.all([open<CheckAsk>(row.sealed_check), open<LiveShare>(row.sealed_live)]);
    out.push({
      id: row.id,
      ownerId: row.owner_id,
      vibe,
      plan,
      requestedAt: row.plan_requested_at,
      declinedAt: row.plan_declined_at,
      sent: Boolean(plan),
      check,
      answered: Boolean(row.sealed_answer),
      live
    });
  }
  return out.sort((a, b) => (a.vibe.date || '9999').localeCompare(b.vibe.date || '9999'));
}

export async function requestPlan(id: string): Promise<void> {
  const { error } = await db.from('scene_vibes').update({ plan_requested_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new AccountError("Ember couldn't send your request. Please try again.");
}
