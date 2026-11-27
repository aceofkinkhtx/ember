import type { Feel } from '../data/activities';
import { AccountError, db, saveProfile, type StoredKeys } from './account';
import { lock, lockBytes, newSecretKey, openSealed, sealFor, unlock, unlockBytes } from './crypto';
import { readJson, writeJson } from './storage';

// Toy collections (M3). Anyone can keep one, whatever their role. Each toy and
// its photo are locked with the owner's toy key before upload. Sharing with a
// connection gives them a copy of the toy keys locked for them alone; turning
// sharing off makes a new key, so nothing added or changed afterward reaches them.

export type PlayType =
  | 'impact'
  | 'sensation'
  | 'rope'
  | 'bondage'
  | 'electro'
  | 'temperature'
  | 'wax'
  | 'fire'
  | 'vibration'
  | 'insertable'
  | 'chastity'
  | 'roleplay'
  | 'more';

/** Kinds of play for gear; more added Nov 26 (Michael). "More" stays last. */
export const playTypes: { id: PlayType; label: string }[] = [
  { id: 'impact', label: 'Impact' },
  { id: 'sensation', label: 'Sensation' },
  { id: 'rope', label: 'Rope' },
  { id: 'bondage', label: 'Bondage' },
  { id: 'electro', label: 'Electro' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'wax', label: 'Wax' },
  { id: 'fire', label: 'Fire' },
  { id: 'vibration', label: 'Vibration' },
  { id: 'insertable', label: 'Insertable' },
  { id: 'chastity', label: 'Chastity' },
  { id: 'roleplay', label: 'Roleplay' },
  { id: 'more', label: 'More' }
];

export const feelOptions: { id: Feel; label: string }[] = [
  { id: 'thuddy', label: 'Thuddy' },
  { id: 'stingy', label: 'Stingy' },
  { id: 'sharp', label: 'Sharp' },
  { id: 'other', label: 'Other' }
];

export interface ToyDetails {
  name: string;
  feel: Feel[];
  types: PlayType[];
  /** What it is, in a line or two (Michael, Nov 27). Missing on gear saved before then. */
  description?: string;
  /** What it's made of (Michael, Nov 27). Missing on gear saved before then. */
  material?: string;
  notes: string;
  /** Which toy key locked the first photo; null when there is no photo. Kept for older copies of Ember. */
  photoGen: number | null;
  /** Every photo, first one first (Michael, Nov 26). Missing on gear saved before then. */
  photos?: ToyPhotoRef[];
  /** Where the thumbnail sits on the first photo (Michael, Nov 27); centred when missing. */
  thumb?: Thumb & { photoId: string };
}

/**
 * A square thumbnail's place on a photo, in the square's own widths: its
 * top-left corner (x, y) and the photo's width (z). The photo stays whole.
 */
export interface Thumb {
  x: number;
  y: number;
  z: number;
}

/** The thumbnail placement for the first photo, if one was chosen for it. */
export function thumbOf(t: ToyDetails): Thumb | null {
  const first = photosOf(t)[0];
  return first && t.thumb && t.thumb.photoId === first.id ? t.thumb : null;
}

/** One photo of a piece of gear. The first photo ever saved has the id "". */
export interface ToyPhotoRef {
  id: string;
  /** Which toy key locked it. */
  gen: number;
}

export const MAX_PHOTOS = 6;

/** A toy's photos, including one saved before gear could have several. */
export function photosOf(t: ToyDetails): ToyPhotoRef[] {
  return t.photos ?? (t.photoGen !== null ? [{ id: '', gen: t.photoGen }] : []);
}

/** Photos to add (new bytes) and to remove (by id) when a toy is saved. */
export interface PhotoEdits {
  add: Uint8Array[];
  remove: string[];
  /** A new thumbnail placement for whichever photo ends up first. */
  thumb?: Thumb;
}

export interface Toy extends ToyDetails {
  id: string;
  ownerId: string;
  updatedAt: string;
}

export function emptyToy(): ToyDetails {
  return { name: '', feel: [], types: [], description: '', material: '', notes: '', photoGen: null };
}

export const BUCKET = 'toy-photos';

// Keys -------------------------------------------------------------------------

export interface ToyKeyGen {
  g: number;
  key: string;
}
export interface ToyRing {
  gens: ToyKeyGen[];
}

export const TOY_RING = 'ember.toyKeys';

export function loadToyRing(): ToyRing | null {
  return readJson<ToyRing>(TOY_RING);
}

function storeToyRing(ring: ToyRing): void {
  writeJson(TOY_RING, ring);
}

async function ensureToyRing(keys: StoredKeys): Promise<ToyRing> {
  const existing = loadToyRing();
  if (existing?.gens.length) return existing;
  const ring = { gens: [{ g: 1, key: await newSecretKey() }] };
  storeToyRing(ring);
  await saveProfile(keys, { toyRing: ring });
  return ring;
}

const current = (ring: ToyRing) => ring.gens[ring.gens.length - 1];

// Locking ------------------------------------------------------------------------

interface SealedToy {
  v: 1;
  g: number;
  d: string;
}

async function sealToy(details: ToyDetails, gen: ToyKeyGen): Promise<string> {
  return JSON.stringify({ v: 1, g: gen.g, d: await lock(JSON.stringify(details), gen.key) } satisfies SealedToy);
}

async function openToy(text: string, gens: ToyKeyGen[]): Promise<ToyDetails | null> {
  const sealed = JSON.parse(text) as SealedToy;
  const gen = gens.find((x) => x.g === sealed.g);
  if (!gen) return null;
  return { ...emptyToy(), ...(JSON.parse(await unlock(sealed.d, gen.key)) as ToyDetails) };
}

async function openRows(
  rows: { id: string; owner_id: string; sealed_toy: string; updated_at: string }[],
  gens: ToyKeyGen[]
): Promise<Toy[]> {
  const out: Toy[] = [];
  for (const r of rows) {
    const details = await openToy(r.sealed_toy, gens).catch(() => null);
    if (details) out.push({ ...details, id: r.id, ownerId: r.owner_id, updatedAt: r.updated_at });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Your toys ----------------------------------------------------------------------

export async function listMyToys(keys: StoredKeys): Promise<Toy[]> {
  const { data, error } = await db.from('toys').select('id, owner_id, sealed_toy, updated_at').eq('owner_id', keys.userId);
  if (error) throw new AccountError("Ember couldn't load your gear.");
  const ring = loadToyRing();
  return ring ? openRows(data ?? [], ring.gens) : [];
}

// The first photo keeps the path single photos always had; others add their id.
const photoPath = (ownerId: string, toyId: string, photoId = '') => (photoId ? `${ownerId}/${toyId}-${photoId}` : `${ownerId}/${toyId}`);

/** Saves a toy, adding and removing photos as asked. */
export async function saveToy(keys: StoredKeys, toy: { id?: string; details: ToyDetails }, edits: PhotoEdits = { add: [], remove: [] }): Promise<Toy> {
  const ring = await ensureToyRing(keys);
  const gen = current(ring);
  const id = toy.id ?? crypto.randomUUID();
  const details: ToyDetails = { ...toy.details, name: toy.details.name.trim() };
  let photos = photosOf(toy.details);

  if (edits.remove.length) {
    const gone = photos.filter((p) => edits.remove.includes(p.id));
    if (gone.length) await db.storage.from(BUCKET).remove(gone.map((p) => photoPath(keys.userId, id, p.id)));
    photos = photos.filter((p) => !edits.remove.includes(p.id));
  }
  for (const bytes of edits.add.slice(0, Math.max(0, MAX_PHOTOS - photos.length))) {
    // A toy with no photos yet uses the original path, so older copies of Ember still show it.
    const photoId = photos.length ? crypto.randomUUID().slice(0, 8) : '';
    const locked = await lockBytes(bytes, gen.key);
    const { error } = await db.storage.from(BUCKET).upload(photoPath(keys.userId, id, photoId), locked, {
      upsert: true,
      contentType: 'application/octet-stream',
      cacheControl: '0'
    });
    if (error) throw new AccountError("Ember couldn't save the photo. Please try again.");
    photos = [...photos, { id: photoId, gen: gen.g }];
  }
  if (edits.add.length || edits.remove.length) forgetPhoto(id);
  details.photos = photos;
  details.photoGen = photos[0]?.gen ?? null;
  if (edits.thumb && photos[0]) details.thumb = { ...edits.thumb, photoId: photos[0].id };
  else if (!thumbOf(details)) delete details.thumb;

  const now = new Date().toISOString();
  const sealed = await sealToy(details, gen);
  const { error } = toy.id
    ? await db.from('toys').update({ sealed_toy: sealed, updated_at: now }).eq('id', id)
    : await db.from('toys').insert({ id, owner_id: keys.userId, sealed_toy: sealed });
  if (error) throw new AccountError("Ember couldn't save that. Please try again.");
  return { ...details, id, ownerId: keys.userId, updatedAt: now };
}

export async function deleteToy(keys: StoredKeys, toy: Toy): Promise<void> {
  const { error } = await db.from('toys').delete().eq('id', toy.id);
  if (error) throw new AccountError("Ember couldn't delete that.");
  const photos = photosOf(toy);
  if (photos.length) await db.storage.from(BUCKET).remove(photos.map((p) => photoPath(keys.userId, toy.id, p.id)));
  forgetPhoto(toy.id);
}

// Photos -------------------------------------------------------------------------

const photoUrls = new Map<string, string>();

function forgetPhoto(toyId: string): void {
  for (const [key, url] of photoUrls) {
    if (key.split(':')[0] !== toyId) continue;
    URL.revokeObjectURL(url);
    photoUrls.delete(key);
  }
}

/**
 * Downloads and unlocks a toy's photo, returning a link that lives only in
 * this tab. The file cache keeps a copy per sign-in, so each download asks with
 * a fresh value: access is then checked every time.
 */
export async function photoUrl(toy: Toy, gens: ToyKeyGen[], photoId?: string): Promise<string | null> {
  const all = photosOf(toy);
  const photo = photoId === undefined ? all[0] : all.find((p) => p.id === photoId);
  if (!photo) return null;
  const cacheKey = `${toy.id}:${photo.id}`;
  const cached = photoUrls.get(cacheKey);
  if (cached) return cached;
  const gen = gens.find((x) => x.g === photo.gen);
  if (!gen) return null;
  const { data } = await db.storage.from(BUCKET).download(photoPath(toy.ownerId, toy.id, photo.id), { cacheNonce: crypto.randomUUID() });
  if (!data) return null;
  const bytes = await unlockBytes(new Uint8Array(await data.arrayBuffer()), gen.key).catch(() => null);
  if (!bytes) return null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  photoUrls.set(cacheKey, url);
  return url;
}

// Sharing ------------------------------------------------------------------------

export async function listToyShares(keys: StoredKeys): Promise<string[]> {
  const { data, error } = await db.from('toy_shares').select('recipient_id').eq('owner_id', keys.userId);
  if (error) throw new AccountError("Ember couldn't load your gear sharing.");
  return (data ?? []).map((r) => r.recipient_id as string);
}

async function writeToyShare(keys: StoredKeys, ring: ToyRing, recipientId: string): Promise<void> {
  const { data: pk } = await db.from('public_keys').select('public_key').eq('user_id', recipientId).single();
  if (!pk) throw new AccountError('Ember can only share with someone you are connected to.');
  const wrapped = await sealFor(JSON.stringify(ring), pk.public_key);
  await db.from('toy_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', recipientId);
  const { error } = await db.from('toy_shares').insert({ owner_id: keys.userId, recipient_id: recipientId, wrapped_toy_key: wrapped });
  if (error) throw new AccountError("Ember couldn't update gear sharing. Please try again.");
}

/** Shares your toys with one connection, or stops (with new keys for what comes next). */
export async function setToyShare(keys: StoredKeys, recipientId: string, on: boolean): Promise<void> {
  let ring = await ensureToyRing(keys);
  const shares = await listToyShares(keys);
  if (on) {
    if (!shares.includes(recipientId)) await writeToyShare(keys, ring, recipientId);
    return;
  }
  if (!shares.includes(recipientId)) return;
  const { error } = await db.from('toy_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', recipientId);
  if (error) throw new AccountError("Ember couldn't stop sharing. Please try again.");
  ring = { gens: [...ring.gens, { g: current(ring).g + 1, key: await newSecretKey() }] };
  storeToyRing(ring);
  await saveProfile(keys, { toyRing: ring });
  for (const other of shares.filter((x) => x !== recipientId)) await writeToyShare(keys, ring, other);
}

/** Toys a connection shares with you, or null if they don't share them. */
export async function readTheirToys(keys: StoredKeys, ownerId: string): Promise<{ toys: Toy[]; gens: ToyKeyGen[] } | null> {
  const { data: share } = await db
    .from('toy_shares')
    .select('wrapped_toy_key')
    .eq('owner_id', ownerId)
    .eq('recipient_id', keys.userId)
    .maybeSingle();
  if (!share) return null;
  const { gens } = JSON.parse(await openSealed(share.wrapped_toy_key, keys)) as ToyRing;
  const { data, error } = await db.from('toys').select('id, owner_id, sealed_toy, updated_at').eq('owner_id', ownerId);
  if (error) throw new AccountError("Ember couldn't load their gear.");
  return { toys: await openRows(data ?? [], gens), gens };
}

// Opt-outs -----------------------------------------------------------------------

export interface OptOut {
  connectionId: string;
  toyId: string;
  /** Who set it: the toy's owner, or the other person ("Not for me"). Only they can clear it. */
  setBy: string;
}

/** Opt-outs you can see: for your toys, and on your connections. */
export async function listOptOuts(): Promise<OptOut[]> {
  const { data, error } = await db.from('toy_opt_outs').select('connection_id, toy_id, set_by');
  if (error) throw new AccountError("Ember couldn't load gear opt-outs.");
  return (data ?? []).map((r) => ({ connectionId: r.connection_id as string, toyId: r.toy_id as string, setBy: r.set_by as string }));
}

/**
 * Keeps a toy out of (or back in) scenes with one connection: one of yours,
 * or, as "Not for me", one of theirs. Clearing only ever removes your own.
 */
export async function setOptOut(connectionId: string, toyId: string, out: boolean): Promise<void> {
  const { error } = out
    ? await db.from('toy_opt_outs').upsert({ connection_id: connectionId, toy_id: toyId }, { ignoreDuplicates: true })
    : await db.from('toy_opt_outs').delete().eq('connection_id', connectionId).eq('toy_id', toyId);
  if (error) throw new AccountError("Ember couldn't update that. Please try again.");
}

/** Whether a connection shares their toys with you, without loading them. */
export async function theyShareToys(keys: StoredKeys, ownerId: string): Promise<boolean> {
  const { data } = await db.from('toy_shares').select('owner_id').eq('owner_id', ownerId).eq('recipient_id', keys.userId).maybeSingle();
  return Boolean(data);
}
