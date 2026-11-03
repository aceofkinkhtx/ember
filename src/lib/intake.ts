import type { Identity } from '../content/identity';
import type { Dot, GroupId, PresenceAnswer } from '../content/intake';
import { activities, type Activity, type Feel } from '../data/activities';
import { AccountError, db, saveProfile, type StoredKeys } from './account';
import { lock, newSecretKey, openSealed, sealFor, unlock } from './crypto';
import { readJson, writeJson } from './storage';

// The bottom's intake (M2): what it holds, the draft on this phone, and the
// locked versions on the server. Essentials and the rest of the profile are
// locked with different keys, so "essentials only" sharing really is only that.

export type Choice = 'yes' | 'maybe' | 'no';

export interface Essentials {
  signals: { green: string; yellow: string; red: string; handSign: string; custom: string };
  experience: string | null;
  speakUp: string | null;
  body: { areas: string[]; notes: string; allergies: string };
  triggers: { chips: string[]; notes: string };
  overwhelm: { chips: string[]; notes: string };
  emergency: { kind: 'person'; name: string; phone: string; aware: 'yes' | 'some' | 'no' | null } | { kind: '911' } | null;
  /** When the substance agreement was accepted. */
  substanceAgreedAt: string | null;
  honorifics: string[];
  honorificCustom: string;
  /** Always asked, whatever the path, so even "essentials only" shows them. */
  limits: { hard: string; soft: string };
  /** "My Top may override a no after we talk." Off by default; every change is dated. */
  allowNoOverride: { on: boolean; changedAt: string | null };
}

export interface QuickPath {
  words: Record<GroupId, string[]>;
  decoder: Partial<Record<GroupId, string[]>>;
}

export interface MyBody {
  /** Null means "show me everything". */
  frontHole: boolean | null;
  wordsWelcome: string;
  wordsAvoid: string;
}

export interface Detailed {
  answers: Record<string, { choice: Choice; intensity?: number }>;
  custom: Activity[];
  impact: { areas: string[]; positions: string[]; feel: Feel[]; marks: string | null };
  words: { welcome: string; offLimits: string };
  limits: { hardExtra: string; noTouch: string };
}

export interface Aftercare {
  map: Dot | null;
  nextDay: Dot | null;
  extras: string[];
  presence: Partial<Record<'video' | 'watching' | 'joining' | 'public', PresenceAnswer>>;
  curiosity: string;
}

export type PathId = 'quick' | 'map' | 'detailed';

export interface Intake {
  v: 1;
  essentials: Essentials;
  paths: PathId[];
  quick: QuickPath | null;
  desireMap: Dot | null;
  myBody: MyBody | null;
  detailed: Detailed | null;
  aftercare: Aftercare | null;
  /**
   * The no and maybe lists from the detailed path, copied into the essentials
   * part when saved, so anyone with essentials access sees every limit.
   */
  sharedLimits?: { hard: string[]; soft: string[] };
  /** When each section last changed. */
  updated: Partial<Record<'essentials' | 'quick' | 'desireMap' | 'detailed' | 'aftercare', string>>;
}

export function emptyEssentials(): Essentials {
  return {
    signals: { green: 'Green', yellow: 'Yellow', red: 'Red', handSign: 'Tap out three times', custom: '' },
    experience: null,
    speakUp: null,
    body: { areas: [], notes: '', allergies: '' },
    triggers: { chips: [], notes: '' },
    overwhelm: { chips: [], notes: '' },
    emergency: null,
    substanceAgreedAt: null,
    honorifics: [],
    honorificCustom: '',
    limits: { hard: '', soft: '' },
    allowNoOverride: { on: false, changedAt: null }
  };
}

export function emptyIntake(): Intake {
  return { v: 1, essentials: emptyEssentials(), paths: [], quick: null, desireMap: null, myBody: null, detailed: null, aftercare: null, updated: {} };
}

export function emptyDetailed(): Detailed {
  return {
    answers: {},
    custom: [],
    impact: { areas: [], positions: [], feel: [], marks: null },
    words: { welcome: '', offLimits: '' },
    limits: { hardExtra: '', noTouch: '' }
  };
}

export function emptyAftercare(): Aftercare {
  return { map: null, nextDay: null, extras: [], presence: {}, curiosity: '' };
}

/** What the safety floor needs before an intake can be saved or shared. */
export function essentialsMissing(e: Essentials): string[] {
  const missing: string[] = [];
  if (!e.signals.red.trim() || !e.signals.yellow.trim() || !e.signals.green.trim()) missing.push('your signal words');
  if (!e.emergency || (e.emergency.kind === 'person' && (!e.emergency.name.trim() || !e.emergency.phone.trim())))
    missing.push('an emergency contact (or Call 911)');
  if (!e.substanceAgreedAt) missing.push('the substance agreement');
  return missing;
}

/** Every activity a person can answer, including their own additions. */
export function allActivities(d: Detailed | null, body: MyBody | null): Activity[] {
  const list = [...activities, ...(d?.custom ?? [])];
  return body?.frontHole === false ? list.filter((a) => a.anatomy !== 'front-hole') : list;
}

/** No answers fill the limit strip; maybes are soft limits. */
export function limitsOf(intake: Intake): { hard: string[]; soft: string[] } {
  const d = intake.detailed;
  if (!d) return intake.sharedLimits ?? { hard: [], soft: [] };
  const label = (id: string) => [...activities, ...d.custom].find((a) => a.id === id)?.label ?? id;
  const hard = Object.entries(d.answers).filter(([, v]) => v.choice === 'no').map(([id]) => label(id));
  const soft = Object.entries(d.answers).filter(([, v]) => v.choice === 'maybe').map(([id]) => label(id));
  return { hard, soft };
}

// The draft on this phone ---------------------------------------------------

const DRAFT = 'ember.intakeDraft';

export interface Draft {
  intake: Intake;
  /** The saved version this draft started from, if any. */
  basedOn: { id: string; version: number } | null;
}

export function loadDraft(): Draft | null {
  return readJson<Draft>(DRAFT);
}

export function saveDraft(draft: Draft): void {
  writeJson(DRAFT, draft);
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT);
  } catch {
    // Nothing saved.
  }
}

// Profile keys ----------------------------------------------------------------

/** One generation of profile keys. A new generation is made whenever access is taken away. */
export interface KeyGen {
  g: number;
  essentials: string;
  full: string;
}

export interface KeyRing {
  gens: KeyGen[];
}

const RING = 'ember.profileKeys';

export function loadRing(): KeyRing | null {
  return readJson<KeyRing>(RING);
}

export function storeRing(ring: KeyRing): void {
  writeJson(RING, ring);
}

async function ensureRing(keys: StoredKeys, identity: unknown): Promise<KeyRing> {
  const existing = loadRing();
  if (existing?.gens.length) return existing;
  const ring = { gens: [{ g: 1, essentials: await newSecretKey(), full: await newSecretKey() }] };
  storeRing(ring);
  await saveProfile(keys, { identity: identity as Identity, keyRing: ring });
  return ring;
}

const current = (ring: KeyRing) => ring.gens[ring.gens.length - 1];

// Versions --------------------------------------------------------------------

interface Sealed {
  v: 1;
  g: number;
  e: string;
  f: string;
}

type EssentialsPart = Pick<Intake, 'essentials' | 'sharedLimits'>;
type FullPart = Omit<Intake, 'essentials'>;

async function sealIntake(intake: Intake, gen: KeyGen): Promise<string> {
  const { essentials, ...rest } = intake;
  const sealed: Sealed = {
    v: 1,
    g: gen.g,
    e: await lock(JSON.stringify({ essentials, sharedLimits: limitsOf(intake) } satisfies EssentialsPart), gen.essentials),
    f: await lock(JSON.stringify(rest satisfies FullPart), gen.full)
  };
  return JSON.stringify(sealed);
}

/** Opens what the keys allow. Without the full key, only essentials come back. */
async function openIntake(text: string, gens: Partial<KeyGen>[]): Promise<{ intake: Intake; full: boolean } | null> {
  const sealed = JSON.parse(text) as Sealed;
  const gen = gens.find((x) => x.g === sealed.g);
  if (!gen?.essentials) return null;
  const { essentials, sharedLimits } = JSON.parse(await unlock(sealed.e, gen.essentials)) as EssentialsPart;
  const withDefaults = { ...emptyEssentials(), ...essentials };
  if (!gen.full) return { intake: { ...emptyIntake(), essentials: withDefaults, sharedLimits }, full: false };
  const rest = JSON.parse(await unlock(sealed.f, gen.full)) as FullPart;
  return { intake: { ...rest, essentials: withDefaults, sharedLimits }, full: true };
}

export interface Version {
  id: string;
  version: number;
  createdAt: string;
  reusedFrom: string | null;
  intake: Intake;
}

export async function saveVersion(keys: StoredKeys, identity: unknown, draft: Draft): Promise<Version> {
  const missing = essentialsMissing(draft.intake.essentials);
  if (missing.length) throw new AccountError(`Please add ${missing.join(', ')} first.`);
  const ring = await ensureRing(keys, identity);
  const { data, error } = await db
    .from('intakes')
    .insert({ owner_id: keys.userId, sealed_intake: await sealIntake(draft.intake, current(ring)), reused_from: draft.basedOn?.id ?? null })
    .select('id, version, created_at, reused_from')
    .single();
  if (error) throw new AccountError("Ember couldn't save your intake. Please try again.");
  return { id: data.id, version: data.version, createdAt: data.created_at, reusedFrom: data.reused_from, intake: draft.intake };
}

export async function listVersions(keys: StoredKeys): Promise<Version[]> {
  const ring = loadRing();
  const { data, error } = await db
    .from('intakes')
    .select('id, version, created_at, reused_from, sealed_intake')
    .eq('owner_id', keys.userId)
    .order('version', { ascending: false });
  if (error) throw new AccountError("Ember couldn't load your intakes.");
  if (!ring) return [];
  const out: Version[] = [];
  for (const r of data ?? []) {
    const opened = await openIntake(r.sealed_intake, ring.gens).catch(() => null);
    if (opened) out.push({ id: r.id, version: r.version, createdAt: r.created_at, reusedFrom: r.reused_from, intake: opened.intake });
  }
  return out;
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await db.from('intakes').delete().eq('id', id);
  if (error) throw new AccountError("Ember couldn't delete that intake.");
}

// Sharing ---------------------------------------------------------------------

export type Scope = 'full' | 'essentials';

export interface Share {
  recipientId: string;
  scope: Scope;
}

export async function listShares(keys: StoredKeys): Promise<Share[]> {
  const { data, error } = await db.from('profile_shares').select('recipient_id, scope').eq('owner_id', keys.userId);
  if (error) throw new AccountError("Ember couldn't load your sharing settings.");
  return (data ?? []).map((r) => ({ recipientId: r.recipient_id, scope: r.scope as Scope }));
}

async function writeShare(keys: StoredKeys, ring: KeyRing, share: Share): Promise<void> {
  const { data: pk } = await db.from('public_keys').select('public_key').eq('user_id', share.recipientId).single();
  if (!pk) throw new AccountError('Ember can only share with someone you are connected to.');
  const gens = ring.gens.map((g) => (share.scope === 'full' ? g : { g: g.g, essentials: g.essentials }));
  const wrapped = await sealFor(JSON.stringify({ gens }), pk.public_key);
  await db.from('profile_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', share.recipientId);
  const { error } = await db
    .from('profile_shares')
    .insert({ owner_id: keys.userId, recipient_id: share.recipientId, scope: share.scope, wrapped_profile_key: wrapped });
  if (error) throw new AccountError("Ember couldn't update sharing. Please try again.");
}

/**
 * Sets what one connection can see: the full profile, essentials only, or
 * nothing (null). Taking access away makes new keys, so anything saved from
 * now on is out of reach for them, and everyone else keeps access.
 */
export async function setShare(keys: StoredKeys, identity: unknown, recipientId: string, scope: Scope | null): Promise<void> {
  let ring = await ensureRing(keys, identity);
  const shares = await listShares(keys);
  const before = shares.find((s) => s.recipientId === recipientId)?.scope ?? null;
  const reduced = before === 'full' ? scope !== 'full' : before === 'essentials' ? scope === null : false;

  if (scope === null) {
    const { error } = await db.from('profile_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', recipientId);
    if (error) throw new AccountError("Ember couldn't stop sharing. Please try again.");
  }

  if (reduced) {
    const last = current(ring);
    ring = { gens: [...ring.gens, { g: last.g + 1, essentials: await newSecretKey(), full: await newSecretKey() }] };
    storeRing(ring);
    await saveProfile(keys, { identity: identity as Identity, keyRing: ring });
  }

  const next = shares.filter((s) => s.recipientId !== recipientId).concat(scope ? [{ recipientId, scope }] : []);
  // After new keys, everyone who still has access gets them; otherwise only this person changes.
  for (const s of reduced ? next : next.filter((x) => x.recipientId === recipientId)) await writeShare(keys, ring, s);
}

export interface SharedProfile {
  version: number;
  createdAt: string;
  full: boolean;
  intake: Intake;
}

/** The latest intake someone shared with you, as far as your access goes. */
export async function readSharedProfile(keys: StoredKeys, ownerId: string): Promise<SharedProfile | null> {
  const { data: share } = await db
    .from('profile_shares')
    .select('wrapped_profile_key')
    .eq('owner_id', ownerId)
    .eq('recipient_id', keys.userId)
    .maybeSingle();
  if (!share) return null;
  const { gens } = JSON.parse(await openSealed(share.wrapped_profile_key, keys)) as { gens: Partial<KeyGen>[] };
  const { data } = await db
    .from('intakes')
    .select('version, created_at, sealed_intake')
    .eq('owner_id', ownerId)
    .order('version', { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const opened = await openIntake(row.sealed_intake, gens).catch(() => null);
  return opened ? { version: row.version, createdAt: row.created_at, full: opened.full, intake: opened.intake } : null;
}

/**
 * Reapplies one change on top of the newest answers. Each tap builds its
 * change from the answers it saw; two quick taps can both see the same old
 * answers, so without this the second would erase the first. Lists merge by
 * what was added and removed, so two chips tapped quickly both stick.
 */
export function mergeChange<T>(base: T, next: T, latest: T): T {
  if (Object.is(next, base)) return latest;
  if (Array.isArray(base) && Array.isArray(next) && Array.isArray(latest)) {
    const added = next.filter((x) => !base.includes(x));
    const removed = base.filter((x) => !next.includes(x));
    return [...latest.filter((x) => !removed.includes(x)), ...added.filter((x) => !latest.includes(x))] as T;
  }
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
  if (isObj(base) && isObj(next) && isObj(latest)) {
    const out: Record<string, unknown> = { ...latest };
    for (const k of new Set([...Object.keys(base), ...Object.keys(next)])) {
      if (!(k in next)) delete out[k];
      else out[k] = mergeChange(base[k], next[k], latest[k]);
    }
    return out as T;
  }
  return next;
}
