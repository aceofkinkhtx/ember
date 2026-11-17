import { AccountError, db, type StoredKeys } from './account';
import { openSealed, sealFor } from './crypto';
import { partnerKey } from './vibes';
import type { Scene } from './scene/model';
import { choiceLabel, furniture, positions } from '../data/positions';

// Scene negotiations (Michael, Nov 16). Either person proposes a scene as a
// plain list of activities, positions, furniture and feelings. The other keeps,
// removes or adds items and sends it back, or approves it as is. Once one of
// them approves the other's latest version it's agreed, and the Top designs
// from it. The list is sealed to both people on the sender's phone.

export type ItemKind = 'activity' | 'feel' | 'custom' | 'position' | 'furniture';

export interface NegItem {
  id: string;
  kind: ItemKind;
  /** The activity, position or furniture id; null for feelings and their own words. */
  ref: string | null;
  label: string;
  addedBy: string;
  /** Set when someone took it off the list; it stays visible, crossed out, so changes are clear. */
  removedBy: string | null;
}

/**
 * A "no" in the bottom's own profile that she chose to allow for this scene,
 * after a warning. Only her own phone adds these.
 */
export interface NoAllowed {
  activityId: string;
  at: string;
}

export interface NegEvent {
  by: string;
  at: string;
  text: string;
}

export interface NegBody {
  v: 1;
  /** Who Tops this scene. */
  topId: string;
  /** Rough timing, in their own words ("Saturday evening, about 2 hours"). */
  when: string;
  note: string;
  items: NegItem[];
  /** The Top's gear the bottom marked "Not this time", for this scene only. */
  notThisTime: string[];
  noAllowed: NoAllowed[];
  history: NegEvent[];
  /**
   * A design shared as the proposal (Michael, Nov 16): its activities,
   * positions and furniture are the list. Once agreed, the Top gets this design
   * with anything taken off the list removed.
   */
  design?: Scene;
}

export interface Negotiation {
  id: string;
  connectionId: string;
  starterId: string;
  otherId: string;
  status: 'open' | 'agreed';
  /** Whose move it is while open. */
  turnId: string | null;
  lastBy: string | null;
  round: number;
  updatedAt: string;
  body: NegBody;
}

export const MAX_ITEMS = 80;

export const liveItems = (body: NegBody) => body.items.filter((i) => !i.removedBy);

/** The activities both agreed to (or that are on the table now). */
export const agreedActivityIds = (body: NegBody) => liveItems(body).filter((i) => i.kind === 'activity' && i.ref).map((i) => i.ref as string);

/** The positions and furniture both agreed to (Michael, Nov 16). */
export const agreedSetup = (body: NegBody) => ({
  positions: liveItems(body).filter((i) => i.kind === 'position' && i.ref).map((i) => i.ref as string),
  furniture: liveItems(body).filter((i) => i.kind === 'furniture' && i.ref).map((i) => i.ref as string)
});

/** A design, ready to travel with a proposal: no pairing, no history. */
export function cleanDesign(scene: Scene): Scene {
  const d = structuredClone(scene);
  return {
    ...d,
    connectionId: null,
    partnerId: null,
    partnerName: '',
    overrides: [],
    kept: {},
    agreed: undefined,
    request: undefined,
    fromRequest: undefined,
    share: undefined,
    checkAskedAt: undefined,
    live: undefined,
    inLibrary: false
  };
}

/** The list a shared design stands for: its activities, positions and furniture. */
export function itemsFromDesign(scene: Scene, me: string, labelOf: (activityId: string) => string | undefined): NegItem[] {
  const out: NegItem[] = [];
  const add = (id: string, kind: ItemKind, ref: string, label: string) => {
    if (!out.some((i) => i.id === id)) out.push({ id, kind, ref, label, addedBy: me, removedBy: null });
  };
  for (const phase of scene.phases) {
    if (phase.setup?.position) add(`p:${phase.setup.position}`, 'position', phase.setup.position, choiceLabel(positions, phase.setup.position) ?? phase.setup.position);
    if (phase.setup?.furniture) add(`u:${phase.setup.furniture}`, 'furniture', phase.setup.furniture, choiceLabel(furniture, phase.setup.furniture) ?? phase.setup.furniture);
    for (const beat of phase.beats)
      for (const step of beat.steps) {
        const label = step.activityId ? labelOf(step.activityId) : undefined;
        if (step.activityId && label) add(`a:${step.activityId}`, 'activity', step.activityId, label);
      }
  }
  return out;
}

/** The Top's copy of an agreed shared design: only what stayed on the list. */
export function designFromAgreed(design: Scene, agreed: NonNullable<Scene['agreed']>): Scene {
  const d = structuredClone(design);
  const ok = new Set(agreed.activityIds);
  return {
    ...d,
    picks: d.picks.filter((p) => ok.has(p.activityId)),
    phases: d.phases.map((phase) => ({
      ...phase,
      setup: phase.setup && {
        position: phase.setup.position && agreed.positions?.includes(phase.setup.position) ? phase.setup.position : null,
        furniture: phase.setup.furniture && agreed.furniture?.includes(phase.setup.furniture) ? phase.setup.furniture : null
      },
      beats: phase.beats.map((beat) => ({ ...beat, steps: beat.steps.filter((st) => !st.activityId || ok.has(st.activityId)) }))
    }))
  };
}

const otherOf = (n: Pick<Negotiation, 'starterId' | 'otherId'>, me: string) => (n.starterId === me ? n.otherId : n.starterId);

async function sealBoth(body: NegBody, starterId: string, otherId: string, keys: StoredKeys) {
  const json = JSON.stringify(body);
  const key = async (id: string) => (id === keys.userId ? keys.publicKey : partnerKey(id));
  return {
    sealed_for_starter: await sealFor(json, await key(starterId)),
    sealed_for_other: await sealFor(json, await key(otherId))
  };
}

function friendly(message: string | undefined, fallback: string): string {
  if (message && /their turn|already agreed|has ended|goes back/i.test(message)) return message;
  return fallback;
}

export async function startNegotiation(keys: StoredKeys, connectionId: string, otherId: string, body: NegBody): Promise<string> {
  const sealed = await sealBoth(body, keys.userId, otherId, keys);
  const { data, error } = await db
    .from('negotiations')
    .insert({ connection_id: connectionId, other_id: otherId, turn_id: otherId, ...sealed })
    .select('id')
    .single();
  if (error) throw new AccountError(friendly(error.message, "Ember couldn't send that. Check your connection and try again."));
  return data.id as string;
}

/**
 * Your move: send it back with your changes, approve it as is (which makes it
 * agreed), or reopen an agreed one to ask for more.
 */
export async function answerNegotiation(keys: StoredKeys, n: Negotiation, body: NegBody, action: 'send' | 'approve'): Promise<void> {
  const sealed = await sealBoth(body, n.starterId, n.otherId, keys);
  const patch =
    action === 'approve'
      ? { ...sealed, status: 'agreed', turn_id: null, updated_at: new Date().toISOString() }
      : { ...sealed, status: 'open', turn_id: otherOf(n, keys.userId), updated_at: new Date().toISOString() };
  const { error } = await db.from('negotiations').update(patch).eq('id', n.id);
  if (error) throw new AccountError(friendly(error.message, "Ember couldn't send that. Check your connection and try again."));
}

export async function removeNegotiation(id: string): Promise<void> {
  const { error } = await db.from('negotiations').delete().eq('id', id);
  if (error) throw new AccountError("Ember couldn't remove that. Please try again.");
}

interface Row {
  id: string;
  connection_id: string;
  starter_id: string;
  other_id: string;
  status: 'open' | 'agreed';
  turn_id: string | null;
  last_by: string | null;
  round: number;
  updated_at: string;
  sealed_for_starter: string;
  sealed_for_other: string;
}

async function open(keys: StoredKeys, r: Row): Promise<Negotiation | null> {
  const body = await openSealed(r.starter_id === keys.userId ? r.sealed_for_starter : r.sealed_for_other, keys)
    .then((t) => JSON.parse(t) as NegBody)
    .catch(() => null);
  if (!body) return null;
  return {
    id: r.id,
    connectionId: r.connection_id,
    starterId: r.starter_id,
    otherId: r.other_id,
    status: r.status,
    turnId: r.turn_id,
    lastBy: r.last_by,
    round: r.round,
    updatedAt: r.updated_at,
    body
  };
}

const COLUMNS = 'id, connection_id, starter_id, other_id, status, turn_id, last_by, round, updated_at, sealed_for_starter, sealed_for_other';

/** Negotiations you're in, newest first; with one connection if given. */
export async function listNegotiations(keys: StoredKeys, connectionId?: string): Promise<Negotiation[]> {
  let q = db.from('negotiations').select(COLUMNS).order('updated_at', { ascending: false });
  if (connectionId) q = q.eq('connection_id', connectionId);
  const { data, error } = await q;
  if (error) throw new AccountError("Ember couldn't load your scene proposals.");
  const out: Negotiation[] = [];
  for (const r of (data ?? []) as Row[]) {
    const n = await open(keys, r);
    if (n) out.push(n);
  }
  return out;
}

export async function getNegotiation(keys: StoredKeys, id: string): Promise<Negotiation | null> {
  const { data, error } = await db.from('negotiations').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new AccountError("Ember couldn't load this scene proposal.");
  return data ? open(keys, data as Row) : null;
}

/** Proposals waiting for you, for a badge on Home and Connections. */
export async function waitingOnMe(keys: StoredKeys): Promise<number> {
  const { count } = await db.from('negotiations').select('id', { count: 'exact', head: true }).eq('turn_id', keys.userId);
  return count ?? 0;
}

/** A plain-language summary of what changed between two versions, for the history. */
export function describeChanges(before: NegBody | null, after: NegBody): string {
  if (!before) return `Proposed ${liveItems(after).length} ${liveItems(after).length === 1 ? 'item' : 'items'}.`;
  const was = new Set(liveItems(before).map((i) => i.id));
  const now = new Set(liveItems(after).map((i) => i.id));
  const added = liveItems(after).filter((i) => !was.has(i.id)).map((i) => i.label);
  const removed = liveItems(before).filter((i) => !now.has(i.id)).map((i) => i.label);
  const parts = [added.length ? `added ${added.join(', ')}` : '', removed.length ? `removed ${removed.join(', ')}` : ''].filter(Boolean);
  if (after.when !== before.when || after.note !== before.note) parts.push('changed the details');
  if (after.notThisTime.length !== before.notThisTime.length) parts.push('changed "Not this time" gear');
  return parts.length ? `${parts.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()) : 'No changes.';
}

export function sameItems(a: NegBody, b: NegBody): boolean {
  const key = (x: NegBody) =>
    JSON.stringify([liveItems(x).map((i) => i.id).sort(), [...x.notThisTime].sort(), x.when, x.note, x.noAllowed.map((n) => n.activityId).sort()]);
  return key(a) === key(b);
}
