import { createClient } from '@supabase/supabase-js';
import { pronounLabel, type Identity } from '../content/identity';
import {
  defaultPasswordParams,
  deriveFromPassword,
  lock,
  newKeyPair,
  newRecoveryCode,
  newSalt,
  newSecretKey,
  openSealed,
  recoveryKey,
  sealFor,
  sodium,
  unlock,
  type KeyPair
} from './crypto';
import { readJson, writeJson } from './storage';
import { supabasePublishableKey, supabaseUrl } from './supabaseConfig';

// Accounts, keys, invites and connections. Everything personal is locked on
// the phone before it is sent; the server stores only locked boxes.

export const db = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Starts with "ember." so erasing the phone's data also signs out.
    storageKey: 'ember.auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const KEYS = 'ember.keys';

export interface StoredKeys extends KeyPair {
  userId: string;
}

export function loadKeys(): StoredKeys | null {
  return readJson<StoredKeys>(KEYS);
}

export function clearKeys(): void {
  try {
    window.localStorage.removeItem(KEYS);
  } catch {
    // Storage unavailable: nothing was saved.
  }
}

export const MIN_PASSWORD = 10;

/** Plain-language messages for the errors people can actually hit. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match an account.";
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. The link is in your inbox.';
  if (/sending (confirmation|recovery|magic link)? ?email|smtp/i.test(message))
    return "Ember couldn't send the email, so the account wasn't made. Please try again later.";
  if (/rate limit|too many/i.test(message)) return 'Too many tries. Wait a few minutes and try again.';
  if (/fetch|network/i.test(message)) return "Ember can't reach the server. Check your connection and try again.";
  return message;
}

export class AccountError extends Error {}

export type SignInResult =
  | { kind: 'ready'; saved: SavedProfile | null }
  | { kind: 'new'; recoveryCode: string }
  | { kind: 'confirm-email' };

/** What Ember keeps, locked, so a new phone gets your setup back. */
export interface SavedProfile {
  identity?: Identity;
}

async function finishSignIn(userId: string, wrapKey: Uint8Array, salt: string): Promise<SignInResult> {
  const { data: profile, error } = await db
    .from('profiles')
    .select('wrapped_private_key, sealed_settings')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AccountError(friendly(error.message));

  if (profile) {
    let privateKey: string;
    try {
      privateKey = await unlock(profile.wrapped_private_key, wrapKey);
    } catch {
      throw new AccountError("Ember couldn't unlock your data with that password.");
    }
    const s = await sodium();
    const publicKey = s.to_base64(s.crypto_scalarmult_base(s.from_base64(privateKey)));
    const keys = { userId, publicKey, privateKey };
    await ensurePublicKey(keys);
    writeJson(KEYS, keys);
    let saved: SavedProfile | null = null;
    if (profile.sealed_settings) {
      try {
        saved = JSON.parse(await openSealed(profile.sealed_settings, keys)) as SavedProfile;
      } catch {
        saved = null;
      }
    }
    return { kind: 'ready', saved };
  }

  // First sign-in: make the keys and the recovery code.
  const pair = await newKeyPair();
  const recoveryCode = await newRecoveryCode();
  const recoverySalt = await newSalt();
  const insert = await db.from('profiles').insert({
    id: userId,
    wrapped_private_key: await lock(pair.privateKey, wrapKey),
    wrap_salt: salt,
    wrap_params: defaultPasswordParams,
    recovery_wrapped_private_key: await lock(pair.privateKey, await recoveryKey(recoveryCode, recoverySalt)),
    recovery_salt: recoverySalt
  });
  if (insert.error) throw new AccountError(friendly(insert.error.message));
  const keys = { userId, ...pair };
  await ensurePublicKey(keys);
  writeJson(KEYS, keys);
  return { kind: 'new', recoveryCode };
}

async function ensurePublicKey(keys: StoredKeys): Promise<void> {
  const { data } = await db.from('public_keys').select('user_id').eq('user_id', keys.userId).maybeSingle();
  if (data) return;
  const { error } = await db.from('public_keys').insert({ user_id: keys.userId, public_key: keys.publicKey });
  if (error) throw new AccountError(friendly(error.message));
}

export async function signUp(email: string, password: string): Promise<SignInResult> {
  const { authSecret, wrapKey, salt } = await deriveFromPassword(email, password);
  const { data, error } = await db.auth.signUp({
    email: email.trim(),
    password: authSecret,
    options: { emailRedirectTo: `${window.location.origin}/connections` }
  });
  if (error) throw new AccountError(friendly(error.message));
  if (!data.session || !data.user) return { kind: 'confirm-email' };
  return finishSignIn(data.user.id, wrapKey, salt);
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const { authSecret, wrapKey, salt } = await deriveFromPassword(email, password);
  const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password: authSecret });
  if (error) throw new AccountError(friendly(error.message));
  return finishSignIn(data.user.id, wrapKey, salt);
}

export async function signOut(): Promise<void> {
  clearKeys();
  await db.auth.signOut({ scope: 'local' });
}

/** Saves your setup, locked so only you can open it. */
export async function saveProfile(keys: StoredKeys, saved: SavedProfile): Promise<void> {
  await db
    .from('profiles')
    .update({ sealed_settings: await sealFor(JSON.stringify(saved), keys.publicKey), updated_at: new Date().toISOString() })
    .eq('id', keys.userId);
}

// Invites ---------------------------------------------------------------

export type InviteKind = 'account' | 'guest';
export type Role = 'top' | 'bottom';
export type IntakePath = 'detailed' | 'words' | 'map';

/** What the person invited sees about who invited them. */
export interface InviteNote {
  name: string;
  pronouns: string;
  message: string;
}

export interface CreatedInvite {
  code: string;
  link: string;
  expiresAt: string;
}

export async function createInvite(
  keys: StoredKeys,
  opts: { kind: InviteKind; role: Role; path: IntakePath | null; note: InviteNote }
): Promise<CreatedInvite> {
  // The key that opens the note travels after the "#" in the link, which
  // browsers never send to a server.
  const noteKey = await newSecretKey();
  const { data, error } = await db
    .from('invites')
    .insert({
      created_by: keys.userId,
      kind: opts.kind,
      inviter_role: opts.role,
      suggested_path: opts.path,
      sealed_note: await lock(JSON.stringify(opts.note), noteKey)
    })
    .select('code, expires_at')
    .single();
  if (error) throw new AccountError(friendly(error.message));
  const page = opts.kind === 'guest' ? 'guest' : 'join';
  return { code: data.code, link: `${window.location.origin}/${page}/${data.code}#${noteKey}`, expiresAt: data.expires_at };
}

export interface InviteInfo {
  kind: InviteKind;
  inviterRole: Role;
  suggestedPath: IntakePath | null;
  inviterPublicKey: string;
  note: InviteNote | null;
  expired: boolean;
  used: boolean;
}

export async function lookupInvite(code: string, noteKey?: string): Promise<InviteInfo | null> {
  const { data, error } = await db.rpc('get_invite', { invite_code: code.trim().toUpperCase() });
  if (error) throw new AccountError(friendly(error.message));
  const row = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!row) return null;
  let note: InviteNote | null = null;
  if (noteKey && typeof row.sealed_note === 'string') {
    try {
      note = JSON.parse(await unlock(row.sealed_note, noteKey)) as InviteNote;
    } catch {
      note = null;
    }
  }
  return {
    kind: row.kind as InviteKind,
    inviterRole: row.inviter_role as Role,
    suggestedPath: (row.suggested_path as IntakePath | null) ?? null,
    inviterPublicKey: row.inviter_public_key as string,
    note,
    expired: Boolean(row.expired),
    used: Boolean(row.used)
  };
}

export interface MyInvite {
  id: string;
  code: string;
  kind: InviteKind;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  /** Locked answers from a guest, if they have replied. */
  sealedAnswers: string | null;
}

export async function listMyInvites(keys: StoredKeys): Promise<MyInvite[]> {
  const { data, error } = await db
    .from('invites')
    .select('id, code, kind, created_at, expires_at, used_at, guest_submissions(sealed_payload)')
    .eq('created_by', keys.userId)
    .order('created_at', { ascending: false });
  if (error) throw new AccountError(friendly(error.message));
  return (data ?? []).map((r) => {
    const subs = r.guest_submissions as unknown as { sealed_payload: string }[] | { sealed_payload: string } | null;
    const sub = Array.isArray(subs) ? subs[0] : subs;
    return {
      id: r.id,
      code: r.code,
      kind: r.kind as InviteKind,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      used: Boolean(r.used_at),
      sealedAnswers: sub?.sealed_payload ?? null
    };
  });
}

export async function cancelInvite(id: string): Promise<void> {
  const { error } = await db.from('invites').delete().eq('id', id);
  if (error) throw new AccountError(friendly(error.message));
}

/** A guest's answers, locked on their device for the person who invited them. */
export interface GuestAnswers {
  name: string;
  pronouns: string;
  message: string;
  adultConfirmedAt: string;
}

export async function submitGuestAnswers(code: string, inviterPublicKey: string, answers: GuestAnswers): Promise<void> {
  const payload = await sealFor(JSON.stringify(answers), inviterPublicKey);
  const { error } = await db.rpc('submit_guest', { invite_code: code.trim().toUpperCase(), payload });
  if (error) throw new AccountError(friendly(error.message));
}

export async function openGuestAnswers(keys: StoredKeys, sealed: string): Promise<GuestAnswers | null> {
  try {
    return JSON.parse(await openSealed(sealed, keys)) as GuestAnswers;
  } catch {
    return null;
  }
}

// Connections -----------------------------------------------------------

/** The small card each person shows the other: name and pronouns. */
export interface Card {
  name: string;
  pronouns: string;
}

export function cardFor(identity: Identity): Card {
  return { name: identity.name.trim(), pronouns: pronounLabel(identity) };
}

export async function acceptInvite(keys: StoredKeys, code: string, me: Card): Promise<string> {
  const { data: connectionId, error } = await db.rpc('accept_invite', { invite_code: code.trim().toUpperCase() });
  if (error) throw new AccountError(friendly(error.message.replace(/^.*?: /, '')));
  await setUpConnection(keys, connectionId as string, me);
  return connectionId as string;
}

/** Makes the connection's shared key, locks a copy for each person, and adds your card. */
async function setUpConnection(keys: StoredKeys, connectionId: string, me: Card): Promise<void> {
  const { data: conn, error } = await db.from('connections').select('top_id, bottom_id').eq('id', connectionId).single();
  if (error) throw new AccountError(friendly(error.message));
  const otherId = conn.top_id === keys.userId ? conn.bottom_id : conn.top_id;
  const { data: other } = await db.from('public_keys').select('public_key').eq('user_id', otherId).single();
  if (!other) throw new AccountError("Ember couldn't find the other person's key. Try again in a moment.");
  const shared = await newSecretKey();
  const keyRows = await db.from('connection_keys').insert([
    { connection_id: connectionId, user_id: keys.userId, wrapped_key: await sealFor(shared, keys.publicKey) },
    { connection_id: connectionId, user_id: otherId, wrapped_key: await sealFor(shared, other.public_key) }
  ]);
  // Already set up from an earlier try: the existing key stays.
  if (keyRows.error && keyRows.error.code !== '23505') throw new AccountError(friendly(keyRows.error.message));
  const sharedKey = keyRows.error ? await myConnectionKey(keys, connectionId) : shared;
  if (sharedKey) await writeCard(keys, connectionId, sharedKey, me);
}

async function myConnectionKey(keys: StoredKeys, connectionId: string): Promise<string | null> {
  const { data } = await db
    .from('connection_keys')
    .select('wrapped_key')
    .eq('connection_id', connectionId)
    .eq('user_id', keys.userId)
    .maybeSingle();
  return data ? openSealed(data.wrapped_key, keys) : null;
}

async function writeCard(keys: StoredKeys, connectionId: string, sharedKey: string, me: Card): Promise<void> {
  await db
    .from('connection_cards')
    .upsert({
      connection_id: connectionId,
      user_id: keys.userId,
      sealed_card: await lock(JSON.stringify(me), sharedKey),
      updated_at: new Date().toISOString()
    });
}

export interface Connection {
  id: string;
  /** Your role with this person. */
  myRole: Role;
  status: 'active' | 'paused' | 'ended';
  since: string;
  /** Null until the other person's card arrives. */
  them: Card | null;
  ready: boolean;
}

/**
 * Lists your connections and keeps your own card on each one up to date, so a
 * name or pronoun change reaches everyone you play with.
 */
export async function listConnections(keys: StoredKeys, me: Card): Promise<Connection[]> {
  const [conns, keyRows, cards] = await Promise.all([
    db.from('connections').select('id, top_id, bottom_id, status, created_at').order('created_at', { ascending: false }),
    db.from('connection_keys').select('connection_id, wrapped_key').eq('user_id', keys.userId),
    db.from('connection_cards').select('connection_id, user_id, sealed_card')
  ]);
  const failure = conns.error ?? keyRows.error ?? cards.error;
  if (failure) throw new AccountError(friendly(failure.message));

  const meJson = JSON.stringify(me);
  return Promise.all(
    (conns.data ?? []).map(async (c) => {
      const myRole: Role = c.top_id === keys.userId ? 'top' : 'bottom';
      const otherId = myRole === 'top' ? c.bottom_id : c.top_id;
      const wrapped = keyRows.data?.find((k) => k.connection_id === c.id)?.wrapped_key;
      const base = { id: c.id, myRole, status: c.status as Connection['status'], since: c.created_at };
      if (!wrapped) return { ...base, them: null, ready: false };
      const shared = await openSealed(wrapped, keys);
      const theirs = cards.data?.find((x) => x.connection_id === c.id && x.user_id === otherId);
      const mine = cards.data?.find((x) => x.connection_id === c.id && x.user_id === keys.userId);
      const myCurrent = mine ? await unlock(mine.sealed_card, shared).catch(() => null) : null;
      if (myCurrent !== meJson) await writeCard(keys, c.id, shared, me);
      let them: Card | null = null;
      if (theirs) {
        try {
          them = JSON.parse(await unlock(theirs.sealed_card, shared)) as Card;
        } catch {
          them = null;
        }
      }
      return { ...base, them, ready: true };
    })
  );
}
