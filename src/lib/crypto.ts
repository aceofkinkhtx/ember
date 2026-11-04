import type _sodium from 'libsodium-wrappers-sumo';

// Every lock and unlock in Ember goes through this file, using libsodium (the sumo build, which includes Argon2 password hashing).
// See docs/encryption-plan.md for the plain-language version.

export type Sodium = typeof _sodium;

// Loaded on first use, so opening the app stays quick.
let loading: Promise<Sodium> | null = null;

export function sodium(): Promise<Sodium> {
  loading ??= import('libsodium-wrappers-sumo').then(async (m) => {
    const s = (m.default ?? m) as Sodium;
    await s.ready;
    return s;
  });
  return loading;
}

export interface PasswordParams {
  v: 1;
  alg: 'argon2id13';
  ops: number;
  mem: number;
}

/** Strong enough for passwords, light enough for an older phone (64 MB). */
export const defaultPasswordParams: PasswordParams = { v: 1, alg: 'argon2id13', ops: 3, mem: 64 * 1024 * 1024 };

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_LENGTH = 24;

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * The sign-in salt has to be known before sign-in, so it comes from the email
 * address rather than the server.
 */
export async function loginSalt(email: string): Promise<Uint8Array> {
  const s = await sodium();
  return s.crypto_generichash(s.crypto_pwhash_SALTBYTES, 'ember-login-v1:' + email.trim().toLowerCase());
}

/**
 * Turns the password into two unrelated secrets: one the server sees for
 * sign-in, and one that never leaves the phone and unlocks the private key.
 */
export async function deriveFromPassword(
  email: string,
  password: string,
  params: PasswordParams = defaultPasswordParams
): Promise<{ authSecret: string; wrapKey: Uint8Array; salt: string }> {
  const s = await sodium();
  const salt = await loginSalt(email);
  const out = s.crypto_pwhash(64, password, salt, params.ops, params.mem, s.crypto_pwhash_ALG_ARGON2ID13);
  return { authSecret: s.to_base64(out.slice(0, 32)), wrapKey: out.slice(32), salt: s.to_base64(salt) };
}

export async function newKeyPair(): Promise<KeyPair> {
  const s = await sodium();
  const kp = s.crypto_box_keypair();
  return { publicKey: s.to_base64(kp.publicKey), privateKey: s.to_base64(kp.privateKey) };
}

export async function newSecretKey(): Promise<string> {
  const s = await sodium();
  return s.to_base64(s.crypto_secretbox_keygen());
}

export async function newRecoveryCode(): Promise<string> {
  const s = await sodium();
  let out = '';
  while (out.length < RECOVERY_CODE_LENGTH) {
    const n = s.randombytes_uniform(CODE_ALPHABET.length);
    out += CODE_ALPHABET[n];
  }
  return out;
}

/** Shown in groups of four so it is easier to copy by hand. */
export function formatRecoveryCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The recovery code is long and random, so a fast keyed hash is enough. */
export async function recoveryKey(code: string, salt: string): Promise<Uint8Array> {
  const s = await sodium();
  return s.crypto_generichash(32, normalizeRecoveryCode(code), s.from_base64(salt));
}

export async function newSalt(): Promise<string> {
  const s = await sodium();
  return s.to_base64(s.randombytes_buf(16));
}

function toKey(s: Sodium, key: Uint8Array | string): Uint8Array {
  return typeof key === 'string' ? s.from_base64(key) : key;
}

/** Locks text with a secret key. The nonce is stored in front of the box. */
export async function lock(text: string, key: Uint8Array | string): Promise<string> {
  const s = await sodium();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const box = s.crypto_secretbox_easy(text, nonce, toKey(s, key));
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return s.to_base64(out);
}

/** Throws if the key is wrong or the box was changed. */
export async function unlock(locked: string, key: Uint8Array | string): Promise<string> {
  const s = await sodium();
  const raw = s.from_base64(locked);
  const nonce = raw.slice(0, s.crypto_secretbox_NONCEBYTES);
  const box = raw.slice(s.crypto_secretbox_NONCEBYTES);
  return s.to_string(s.crypto_secretbox_open_easy(box, nonce, toKey(s, key)));
}

/** Locks text so only the owner of publicKey can open it. */
export async function sealFor(text: string, publicKey: string): Promise<string> {
  const s = await sodium();
  return s.to_base64(s.crypto_box_seal(text, s.from_base64(publicKey)));
}

export async function openSealed(sealed: string, keys: KeyPair): Promise<string> {
  const s = await sodium();
  return s.to_string(s.crypto_box_seal_open(s.from_base64(sealed), s.from_base64(keys.publicKey), s.from_base64(keys.privateKey)));
}

/** Locks raw bytes (a photo) with a secret key. The nonce goes in front. */
export async function lockBytes(bytes: Uint8Array, key: Uint8Array | string): Promise<Uint8Array> {
  const s = await sodium();
  const nonce = s.randombytes_buf(s.crypto_secretbox_NONCEBYTES);
  const box = s.crypto_secretbox_easy(bytes, nonce, toKey(s, key));
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return out;
}

export async function unlockBytes(locked: Uint8Array, key: Uint8Array | string): Promise<Uint8Array> {
  const s = await sodium();
  const nonce = locked.slice(0, s.crypto_secretbox_NONCEBYTES);
  return s.crypto_secretbox_open_easy(locked.slice(s.crypto_secretbox_NONCEBYTES), nonce, toKey(s, key));
}
