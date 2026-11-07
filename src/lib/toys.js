import { AccountError, db, saveProfile } from './account';
import { lock, lockBytes, newSecretKey, openSealed, sealFor, unlock, unlockBytes } from './crypto';
import { readJson, writeJson } from './storage';
export const playTypes = [
    { id: 'impact', label: 'Impact' },
    { id: 'sensation', label: 'Sensation' },
    { id: 'insertable', label: 'Insertable' },
    { id: 'bondage', label: 'Bondage' },
    { id: 'more', label: 'More' }
];
export const feelOptions = [
    { id: 'thuddy', label: 'Thuddy' },
    { id: 'stingy', label: 'Stingy' },
    { id: 'sharp', label: 'Sharp' },
    { id: 'other', label: 'Other' }
];
export function emptyToy() {
    return { name: '', feel: [], types: [], notes: '', photoGen: null };
}
export const BUCKET = 'toy-photos';
export const TOY_RING = 'ember.toyKeys';
export function loadToyRing() {
    return readJson(TOY_RING);
}
function storeToyRing(ring) {
    writeJson(TOY_RING, ring);
}
async function ensureToyRing(keys) {
    const existing = loadToyRing();
    if (existing?.gens.length)
        return existing;
    const ring = { gens: [{ g: 1, key: await newSecretKey() }] };
    storeToyRing(ring);
    await saveProfile(keys, { toyRing: ring });
    return ring;
}
const current = (ring) => ring.gens[ring.gens.length - 1];
async function sealToy(details, gen) {
    return JSON.stringify({ v: 1, g: gen.g, d: await lock(JSON.stringify(details), gen.key) });
}
async function openToy(text, gens) {
    const sealed = JSON.parse(text);
    const gen = gens.find((x) => x.g === sealed.g);
    if (!gen)
        return null;
    return { ...emptyToy(), ...JSON.parse(await unlock(sealed.d, gen.key)) };
}
async function openRows(rows, gens) {
    const out = [];
    for (const r of rows) {
        const details = await openToy(r.sealed_toy, gens).catch(() => null);
        if (details)
            out.push({ ...details, id: r.id, ownerId: r.owner_id, updatedAt: r.updated_at });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
// Your toys ----------------------------------------------------------------------
export async function listMyToys(keys) {
    const { data, error } = await db.from('toys').select('id, owner_id, sealed_toy, updated_at').eq('owner_id', keys.userId);
    if (error)
        throw new AccountError("Ember couldn't load your gear.");
    const ring = loadToyRing();
    return ring ? openRows(data ?? [], ring.gens) : [];
}
const photoPath = (ownerId, toyId) => `${ownerId}/${toyId}`;
/**
 * Saves a toy. `photo` is the new photo's bytes, null to remove the photo, or
 * undefined to keep the one it has.
 */
export async function saveToy(keys, toy, photo) {
    const ring = await ensureToyRing(keys);
    const gen = current(ring);
    const id = toy.id ?? crypto.randomUUID();
    const details = { ...toy.details, name: toy.details.name.trim() };
    const path = photoPath(keys.userId, id);
    if (photo) {
        const locked = await lockBytes(photo, gen.key);
        const { error } = await db.storage.from(BUCKET).upload(path, locked, {
            upsert: true,
            contentType: 'application/octet-stream',
            cacheControl: '0'
        });
        if (error)
            throw new AccountError("Ember couldn't save the photo. Please try again.");
        details.photoGen = gen.g;
        forgetPhoto(id);
    }
    else if (photo === null && details.photoGen !== null) {
        await db.storage.from(BUCKET).remove([path]);
        details.photoGen = null;
        forgetPhoto(id);
    }
    const now = new Date().toISOString();
    const sealed = await sealToy(details, gen);
    const { error } = toy.id
        ? await db.from('toys').update({ sealed_toy: sealed, updated_at: now }).eq('id', id)
        : await db.from('toys').insert({ id, owner_id: keys.userId, sealed_toy: sealed });
    if (error)
        throw new AccountError("Ember couldn't save that. Please try again.");
    return { ...details, id, ownerId: keys.userId, updatedAt: now };
}
export async function deleteToy(keys, toy) {
    const { error } = await db.from('toys').delete().eq('id', toy.id);
    if (error)
        throw new AccountError("Ember couldn't delete that.");
    if (toy.photoGen !== null)
        await db.storage.from(BUCKET).remove([photoPath(keys.userId, toy.id)]);
    forgetPhoto(toy.id);
}
// Photos -------------------------------------------------------------------------
const photoUrls = new Map();
function forgetPhoto(toyId) {
    const url = photoUrls.get(toyId);
    if (url)
        URL.revokeObjectURL(url);
    photoUrls.delete(toyId);
}
/**
 * Downloads and unlocks a toy's photo, returning a link that lives only in
 * this tab. The file cache keeps a copy per sign-in, so each download asks with
 * a fresh value: access is then checked every time.
 */
export async function photoUrl(toy, gens) {
    if (toy.photoGen === null)
        return null;
    const cached = photoUrls.get(toy.id);
    if (cached)
        return cached;
    const gen = gens.find((x) => x.g === toy.photoGen);
    if (!gen)
        return null;
    const { data } = await db.storage.from(BUCKET).download(photoPath(toy.ownerId, toy.id), { cacheNonce: crypto.randomUUID() });
    if (!data)
        return null;
    const bytes = await unlockBytes(new Uint8Array(await data.arrayBuffer()), gen.key).catch(() => null);
    if (!bytes)
        return null;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    photoUrls.set(toy.id, url);
    return url;
}
// Sharing ------------------------------------------------------------------------
export async function listToyShares(keys) {
    const { data, error } = await db.from('toy_shares').select('recipient_id').eq('owner_id', keys.userId);
    if (error)
        throw new AccountError("Ember couldn't load your gear sharing.");
    return (data ?? []).map((r) => r.recipient_id);
}
async function writeToyShare(keys, ring, recipientId) {
    const { data: pk } = await db.from('public_keys').select('public_key').eq('user_id', recipientId).single();
    if (!pk)
        throw new AccountError('Ember can only share with someone you are connected to.');
    const wrapped = await sealFor(JSON.stringify(ring), pk.public_key);
    await db.from('toy_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', recipientId);
    const { error } = await db.from('toy_shares').insert({ owner_id: keys.userId, recipient_id: recipientId, wrapped_toy_key: wrapped });
    if (error)
        throw new AccountError("Ember couldn't update gear sharing. Please try again.");
}
/** Shares your toys with one connection, or stops (with new keys for what comes next). */
export async function setToyShare(keys, recipientId, on) {
    let ring = await ensureToyRing(keys);
    const shares = await listToyShares(keys);
    if (on) {
        if (!shares.includes(recipientId))
            await writeToyShare(keys, ring, recipientId);
        return;
    }
    if (!shares.includes(recipientId))
        return;
    const { error } = await db.from('toy_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', recipientId);
    if (error)
        throw new AccountError("Ember couldn't stop sharing. Please try again.");
    ring = { gens: [...ring.gens, { g: current(ring).g + 1, key: await newSecretKey() }] };
    storeToyRing(ring);
    await saveProfile(keys, { toyRing: ring });
    for (const other of shares.filter((x) => x !== recipientId))
        await writeToyShare(keys, ring, other);
}
/** Toys a connection shares with you, or null if they don't share them. */
export async function readTheirToys(keys, ownerId) {
    const { data: share } = await db
        .from('toy_shares')
        .select('wrapped_toy_key')
        .eq('owner_id', ownerId)
        .eq('recipient_id', keys.userId)
        .maybeSingle();
    if (!share)
        return null;
    const { gens } = JSON.parse(await openSealed(share.wrapped_toy_key, keys));
    const { data, error } = await db.from('toys').select('id, owner_id, sealed_toy, updated_at').eq('owner_id', ownerId);
    if (error)
        throw new AccountError("Ember couldn't load their gear.");
    return { toys: await openRows(data ?? [], gens), gens };
}
/** Opt-outs you can see: for your toys, and on your connections. */
export async function listOptOuts() {
    const { data, error } = await db.from('toy_opt_outs').select('connection_id, toy_id');
    if (error)
        throw new AccountError("Ember couldn't load gear opt-outs.");
    return (data ?? []).map((r) => ({ connectionId: r.connection_id, toyId: r.toy_id }));
}
/** Keeps one of your toys out of (or back in) scenes with one connection. */
export async function setOptOut(connectionId, toyId, out) {
    const { error } = out
        ? await db.from('toy_opt_outs').upsert({ connection_id: connectionId, toy_id: toyId }, { ignoreDuplicates: true })
        : await db.from('toy_opt_outs').delete().eq('connection_id', connectionId).eq('toy_id', toyId);
    if (error)
        throw new AccountError("Ember couldn't update that. Please try again.");
}
/** Whether a connection shares their toys with you, without loading them. */
export async function theyShareToys(keys, ownerId) {
    const { data } = await db.from('toy_shares').select('owner_id').eq('owner_id', ownerId).eq('recipient_id', keys.userId).maybeSingle();
    return Boolean(data);
}
