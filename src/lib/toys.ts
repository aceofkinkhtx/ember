import type { Feel } from '../data/activities';
import { AccountError, db, saveProfile, type StoredKeys } from './account';
import { lock, lockBytes, newSecretKey, openSealed, sealFor, unlock, unlockBytes } from './crypto';
import { readJson, writeJson } from './storage';

// Toy collections (M3). Anyone can keep one, whatever their role. Each toy and
// its photo are locked with the owner's toy key before upload. Sharing with a
// connection gives them a copy of the toy keys locked for them alone; turning
// sharing off makes a new key, so nothing added or changed afterward reaches them.

export type PlayType = 'impact' | 'sensation' | 'insertable' | 'bondage' | 'more';

export const playTypes: { id: PlayType; label: string }[] = [
  { id: 'impact', label: 'Impact' },
  { id: 'sensation', label: 'Sensation' },
  { id: 'insertable', label: 'Insertable' },
  { id: 'bondage', label: 'Bondage' },
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
  notes: string;
  /** Which toy key locked the photo; null when there is no photo. */
  photoGen: number | null;
}

export interface Toy extends ToyDetails {
  id: string;
  ownerId: string;
  updatedAt: string;
}

export function emptyToy(): ToyDetails {
  return { name: '', feel: [], types: [], notes: '', photoGen: null };
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

const photoPath = (ownerId: string, toyId: string) => `${ownerId}/${toyId}`;

/**
 * Saves a toy. `photo` is the new photo's bytes, null to remove the photo, or
 * undefined to keep the one it has.
 */
export async function saveToy(keys: StoredKeys, toy: { id?: string; details: ToyDetails }, photo?: Uint8Array | null): Promise<Toy> {
  const ring = await ensureToyRing(keys);
  const gen = current(ring);
  const id = toy.id ?? crypto.randomUUID();
  const details: ToyDetails = { ...toy.details, name: toy.details.name.trim() };
  const path = photoPath(keys.userId, id);

  if (photo) {
    const locked = await lockBytes(photo, gen.key);
    const { error } = await db.storage.from(BUCKET).upload(path, locked, {
      upsert: true,
      contentType: 'application/octet-stream',
      cacheControl: '0'
    });
    if (error) throw new AccountError("Ember couldn't save the photo. Please try again.");
    details.photoGen = gen.g;
    forgetPhoto(id);
  } else if (photo === null && details.photoGen !== null) {
    await db.storage.from(BUCKET).remove([path]);
    details.photoGen = null;
    forgetPhoto(id);
  }

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
  if (toy.photoGen !== null) await db.storage.from(BUCKET).remove([photoPath(keys.userId, toy.id)]);
  forgetPhoto(toy.id);
}

// Photos -------------------------------------------------------------------------

const photoUrls = new Map<string, string>();

function forgetPhoto(toyId: string): void {
  const url = photoUrls.get(toyId);
  if (url) URL.revokeObjectURL(url);
  photoUrls.delete(toyId);
}

/**
 * Downloads and unlocks a toy's photo, returning a link that lives only in
 * this tab. The file cache keeps a copy per sign-in, so each download asks with
 * a fresh value: access is then checked every time.
 */
export async function photoUrl(toy: Toy, gens: ToyKeyGen[]): Promise<string | null> {
  if (toy.photoGen === null) return null;
  const cached = photoUrls.get(toy.id);
  if (cached) return cached;
  const gen = gens.find((x) => x.g === toy.photoGen);
  if (!gen) return null;
  const { data } = await db.storage.from(BUCKET).download(photoPath(toy.ownerId, toy.id), { cacheNonce: crypto.randomUUID() });
  if (!data) return null;
  const bytes = await unlockBytes(new Uint8Array(await data.arrayBuffer()), gen.key).catch(() => null);
  if (!bytes) return null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  photoUrls.set(toy.id, url);
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
}

/** Opt-outs you can see: for your toys, and on your connections. */
export async function listOptOuts(): Promise<OptOut[]> {
  const { data, error } = await db.from('toy_opt_outs').select('connection_id, toy_id');
  if (error) throw new AccountError("Ember couldn't load gear opt-outs.");
  return (data ?? []).map((r) => ({ connectionId: r.connection_id as string, toyId: r.toy_id as string }));
}

/** Keeps one of your toys out of (or back in) scenes with one connection. */
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
