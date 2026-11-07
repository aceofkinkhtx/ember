import { AccountError, db, saveProfile } from './account';
import { lockBytes, newSecretKey, unlockBytes } from './crypto';
import { readJson, writeJson } from './storage';
export const AVATAR = 'ember.avatar';
export const AVATAR_BUCKET = 'avatars';
export const loadAvatarKey = () => readJson(AVATAR);
const path = (ownerId) => `${ownerId}/avatar`;
/** Uploads a new picture (already shrunk), locked with a fresh key. */
export async function setAvatar(keys, bytes) {
    const avatar = { key: await newSecretKey(), v: Date.now() };
    const { error } = await db.storage
        .from(AVATAR_BUCKET)
        .upload(path(keys.userId), await lockBytes(bytes, avatar.key), { upsert: true, contentType: 'application/octet-stream', cacheControl: '0' });
    if (error)
        throw new AccountError("Ember couldn't save your picture. Please try again.");
    writeJson(AVATAR, avatar);
    await saveProfile(keys, { avatar });
    forget(keys.userId);
    return avatar;
}
export async function removeAvatar(keys) {
    await db.storage.from(AVATAR_BUCKET).remove([path(keys.userId)]);
    try {
        window.localStorage.removeItem(AVATAR);
    }
    catch {
        // Storage unavailable: nothing was kept.
    }
    await saveProfile(keys, { avatar: null });
    forget(keys.userId);
}
const urls = new Map();
function forget(ownerId) {
    const cached = urls.get(ownerId);
    if (cached)
        URL.revokeObjectURL(cached.url);
    urls.delete(ownerId);
}
/**
 * Downloads and unlocks someone's picture, returning a link that lives only in
 * this tab. Each download asks with a fresh value, so access is checked every
 * time rather than served from a cache.
 */
export async function avatarUrl(ownerId, avatar) {
    const cached = urls.get(ownerId);
    if (cached?.v === avatar.v)
        return cached.url;
    const { data } = await db.storage.from(AVATAR_BUCKET).download(path(ownerId), { cacheNonce: crypto.randomUUID() });
    if (!data)
        return null;
    const bytes = await unlockBytes(new Uint8Array(await data.arrayBuffer()), avatar.key).catch(() => null);
    if (!bytes)
        return null;
    forget(ownerId);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    urls.set(ownerId, { v: avatar.v, url });
    return url;
}
