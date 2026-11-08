import { createClient } from '@supabase/supabase-js';
import { pronounLabel, type Identity } from '../content/identity';
import type { TopSetup } from '../content/topSetup';
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
  if (/connections_roles_fit|fit together/i.test(message))
    return "Those roles don't fit together. One of you needs to Top or S/switch, and the other to bottom or S/switch.";
  if (/personal_codes_code_key|code is taken/i.test(message)) return 'That code is taken. Try another.';
  if (/personal_codes_code_check/i.test(message)) return 'Use 4 to 20 letters and numbers, with no spaces.';
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
  /** The keys that lock your intakes (see lib/intake.ts). */
  keyRing?: { gens: { g: number; essentials: string; full: string }[] };
  /** The keys that lock your toys and their photos (see lib/toys.ts). */
  toyRing?: { gens: { g: number; key: string }[] };
  /** A Top's offerings and settings. */
  top?: TopSetup;
  /** The key to your profile picture, or null once removed (see lib/avatar.ts). */
  avatar?: { key: string; v: number } | null;
}

const RING = 'ember.profileKeys';
const TOY_RING = 'ember.toyKeys';
const AVATAR = 'ember.avatar';
const SETTINGS = 'ember.settings';

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
        // A new phone gets the intake keys back.
        if (saved.keyRing && !readJson(RING)) writeJson(RING, saved.keyRing);
        if (saved.toyRing && !readJson(TOY_RING)) writeJson(TOY_RING, saved.toyRing);
        if (saved.avatar && !readJson(AVATAR)) writeJson(AVATAR, saved.avatar);
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
  // Intake keys and any unsaved intake belong to this person, not the phone.
  try {
    window.localStorage.removeItem(RING);
    window.localStorage.removeItem(TOY_RING);
    window.localStorage.removeItem('ember.intakeDraft');
    window.localStorage.removeItem('ember.sceneDraft');
    window.localStorage.removeItem('ember.live');
    window.localStorage.removeItem('ember.clearedThreads');
    window.localStorage.removeItem(AVATAR);
  } catch {
    // Storage unavailable: nothing was saved.
  }
  await db.auth.signOut({ scope: 'local' });
}

/** A Top setup counts only once someone has actually set something. */
const topIsSet = (top: TopSetup | undefined): top is TopSetup => Boolean(top?.offerings.setAt || top?.settings.setAt);

/**
 * Saves your setup, locked so only you can open it. Any part not passed in is
 * taken from this phone, then from what was saved before, so saving one part
 * never drops another (and a phone that never set up offerings can't wipe them).
 */
export async function saveProfile(keys: StoredKeys, saved: SavedProfile = {}): Promise<void> {
  const local = readJson<{ identity?: Identity; top?: TopSetup }>(SETTINGS);
  let before: SavedProfile = {};
  const { data } = await db.from('profiles').select('sealed_settings').eq('id', keys.userId).maybeSingle();
  if (data?.sealed_settings) {
    try {
      before = JSON.parse(await openSealed(data.sealed_settings, keys)) as SavedProfile;
    } catch {
      before = {};
    }
  }
  const merged: SavedProfile = {
    identity: saved.identity ?? local?.identity ?? before.identity,
    top: [saved.top, local?.top].find(topIsSet) ?? before.top,
    keyRing: saved.keyRing ?? readJson<SavedProfile['keyRing']>(RING) ?? before.keyRing,
    toyRing: saved.toyRing ?? readJson<SavedProfile['toyRing']>(TOY_RING) ?? before.toyRing,
    // null means removed, so it can't be filled back in from elsewhere.
    avatar: 'avatar' in saved ? saved.avatar : (readJson<SavedProfile['avatar']>(AVATAR) ?? before.avatar)
  };
  await db
    .from('profiles')
    .update({ sealed_settings: await sealFor(JSON.stringify(merged), keys.publicKey), updated_at: new Date().toISOString() })
    .eq('id', keys.userId);
}

// Invites ---------------------------------------------------------------

export type InviteKind = 'account' | 'guest';
/** Each person's own role in a connection. Two switches can connect. */
export type Role = 'top' | 'bottom' | 'switch';
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
  /** The full intake (M2). Older guest answers have none. */
  intake?: import('./intake').Intake;
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

/** The small card each person shows the other: name, pronouns, and the key to their picture. */
export interface Card {
  name: string;
  pronouns: string;
  photo?: { key: string; v: number };
}

export function cardFor(identity: Identity): Card {
  const photo = readJson<{ key: string; v: number }>(AVATAR);
  return { name: identity.name.trim(), pronouns: pronounLabel(identity), ...(photo ? { photo } : {}) };
}

/** The usual role opposite someone: a Top's bottom, a bottom's Top, a switch's switch. */
export function complement(role: Role): Role {
  return role === 'top' ? 'bottom' : role === 'bottom' ? 'top' : 'switch';
}

/** Two Tops or two bottoms can't plan a scene together; anything with a switch can. */
export function rolesFit(a: Role, b: Role): boolean {
  return a !== b || a === 'switch';
}

export async function acceptInvite(keys: StoredKeys, code: string, me: Card, myRole: Role): Promise<string> {
  const { data: connectionId, error } = await db.rpc('accept_invite', { invite_code: code.trim().toUpperCase(), my_role: myRole });
  if (error) throw new AccountError(friendly(error.message.replace(/^.*?: /, '')));
  await setUpConnection(keys, connectionId as string, me);
  return connectionId as string;
}

/** Makes the connection's shared key, locks a copy for each person, and adds your card. */
async function setUpConnection(keys: StoredKeys, connectionId: string, me: Card): Promise<void> {
  const { data: conn, error } = await db.from('connections').select('user_a, user_b').eq('id', connectionId).single();
  if (error) throw new AccountError(friendly(error.message));
  const otherId = conn.user_a === keys.userId ? conn.user_b : conn.user_a;
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
  /** Your role with this person, and theirs. Each person sets their own. */
  myRole: Role;
  theirRole: Role;
  /** Which column holds your role. */
  mySide: 'a' | 'b';
  /** The other person's account id. */
  otherId: string;
  status: 'active' | 'paused' | 'ended';
  /** Only the person who paused can resume. */
  pausedByMe: boolean;
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
  const [conns, keyRows, cards, accepted] = await Promise.all([
    db.from('connections').select('id, user_a, user_b, role_a, role_b, status, paused_by, created_at').order('created_at', { ascending: false }),
    db.from('connection_keys').select('connection_id, wrapped_key').eq('user_id', keys.userId),
    db.from('connection_cards').select('connection_id, user_id, sealed_card'),
    // Requests you accepted carry the sender's card, locked for you. It stands
    // in until their own card arrives the next time they open Ember.
    db.from('connection_requests').select('from_id, sealed_card').eq('to_id', keys.userId).eq('status', 'accepted')
  ]);
  const failure = conns.error ?? keyRows.error ?? cards.error ?? accepted.error;
  if (failure) throw new AccountError(friendly(failure.message));

  const meJson = JSON.stringify(me);
  return Promise.all(
    (conns.data ?? []).map(async (c) => {
      const mySide: 'a' | 'b' = c.user_a === keys.userId ? 'a' : 'b';
      const otherId = mySide === 'a' ? c.user_b : c.user_a;
      const myRole = (mySide === 'a' ? c.role_a : c.role_b) as Role;
      const theirRole = (mySide === 'a' ? c.role_b : c.role_a) as Role;
      const wrapped = keyRows.data?.find((k) => k.connection_id === c.id)?.wrapped_key;
      const base = {
        id: c.id,
        myRole,
        theirRole,
        mySide,
        otherId,
        status: c.status as Connection['status'],
        pausedByMe: c.paused_by === keys.userId,
        since: c.created_at
      };
      if (!wrapped) return { ...base, them: null, ready: false };
      const shared = await openSealed(wrapped, keys);
      const theirs = cards.data?.find((x) => x.connection_id === c.id && x.user_id === otherId);
      const mine = cards.data?.find((x) => x.connection_id === c.id && x.user_id === keys.userId);
      const myCurrent = mine ? await unlock(mine.sealed_card, shared).catch(() => null) : null;
      if (myCurrent !== meJson && c.status !== 'ended') await writeCard(keys, c.id, shared, me);
      let them: Card | null = null;
      if (theirs) {
        try {
          them = JSON.parse(await unlock(theirs.sealed_card, shared)) as Card;
        } catch {
          them = null;
        }
      }
      const fromRequest = accepted.data?.find((r) => r.from_id === otherId);
      if (!them && fromRequest) {
        try {
          them = JSON.parse(await openSealed(fromRequest.sealed_card, keys)) as Card;
        } catch {
          them = null;
        }
      }
      return { ...base, them, ready: true };
    })
  );
}

/** Rewrites your card on every connection, so a new name or pronouns show up right away. */
export async function refreshMyCards(keys: StoredKeys, me: Card): Promise<void> {
  await listConnections(keys, me);
}

/**
 * Pause, resume or end a connection. Ending is final for both people and
 * withdraws everything either one shared; only a new invite reconnects.
 */
export async function setConnectionStatus(id: string, status: Connection['status']): Promise<void> {
  const { error } = await db.from('connections').update({ status }).eq('id', id);
  if (error) throw new AccountError(friendly(error.message));
}

/** Changes your own role in a connection. The other person's role stays theirs to change. */
export async function setMyRole(connection: Connection, role: Role): Promise<void> {
  const column = connection.mySide === 'a' ? 'role_a' : 'role_b';
  const { error } = await db.from('connections').update({ [column]: role }).eq('id', connection.id);
  if (error) throw new AccountError(friendly(error.message));
}

// Personal codes and requests -------------------------------------------

/** A permanent code you choose. Anyone who types it sees your scene name and role. */
export interface PersonalCode {
  code: string;
  sceneName: string;
  role: Role;
  active: boolean;
}

export async function getMyCode(keys: StoredKeys): Promise<PersonalCode | null> {
  const { data, error } = await db
    .from('personal_codes')
    .select('code, scene_name, role, active')
    .eq('user_id', keys.userId)
    .maybeSingle();
  if (error) throw new AccountError(friendly(error.message));
  return data ? { code: data.code, sceneName: data.scene_name, role: data.role as Role, active: data.active } : null;
}

export function cleanCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function saveMyCode(keys: StoredKeys, code: PersonalCode): Promise<void> {
  const { error } = await db.from('personal_codes').upsert({
    user_id: keys.userId,
    code: cleanCode(code.code),
    scene_name: code.sceneName.trim(),
    role: code.role,
    active: code.active
  });
  if (error) throw new AccountError(friendly(error.message));
}

/** Keeps the scene name and role shown with your code in step with the Me tab. */
export async function syncMyCode(keys: StoredKeys, sceneName: string, role: Role): Promise<void> {
  if (!sceneName.trim()) return;
  await db.from('personal_codes').update({ scene_name: sceneName.trim(), role }).eq('user_id', keys.userId);
}

export async function deleteMyCode(keys: StoredKeys): Promise<void> {
  const { error } = await db.from('personal_codes').delete().eq('user_id', keys.userId);
  if (error) throw new AccountError(friendly(error.message));
}

export interface CodeOwner {
  sceneName: string;
  role: Role;
  publicKey: string;
}

export async function lookupPersonalCode(code: string): Promise<CodeOwner | null> {
  const { data, error } = await db.rpc('get_personal_code', { personal_code: cleanCode(code) });
  if (error) throw new AccountError(friendly(error.message));
  const row = (data as Array<{ scene_name: string; role: Role; owner_public_key: string }> | null)?.[0];
  return row ? { sceneName: row.scene_name, role: row.role, publicKey: row.owner_public_key } : null;
}

/** Sends your scene name and pronouns, locked so only the code's owner can read them. */
export async function sendRequest(code: string, owner: CodeOwner, myRole: Role, me: Card): Promise<void> {
  const card = await sealFor(JSON.stringify(me), owner.publicKey);
  const { error } = await db.rpc('send_request', { personal_code: cleanCode(code), my_role: myRole, card });
  if (error) throw new AccountError(friendly(error.message));
}

export interface IncomingRequest {
  id: string;
  fromRole: Role;
  from: Card | null;
  sentAt: string;
}

export interface OutgoingRequest {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  sentAt: string;
}

export async function listRequests(keys: StoredKeys): Promise<{ incoming: IncomingRequest[]; outgoing: OutgoingRequest[] }> {
  const { data, error } = await db
    .from('connection_requests')
    .select('id, from_id, to_id, from_role, sealed_card, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new AccountError(friendly(error.message));
  const rows = data ?? [];
  const incoming = await Promise.all(
    rows
      .filter((r) => r.to_id === keys.userId && r.status === 'pending')
      .map(async (r) => {
        let from: Card | null = null;
        try {
          from = JSON.parse(await openSealed(r.sealed_card, keys)) as Card;
        } catch {
          from = null;
        }
        return { id: r.id, fromRole: r.from_role as Role, from, sentAt: r.created_at };
      })
  );
  const outgoing = rows
    .filter((r) => r.from_id === keys.userId && r.status !== 'accepted')
    .map((r) => ({ id: r.id, status: r.status as OutgoingRequest['status'], sentAt: r.created_at }));
  return { incoming, outgoing };
}

/** Accepting makes the connection and its shared key; declining can also block. */
export async function respondToRequest(
  keys: StoredKeys,
  requestId: string,
  answer: { accept: true; myRole: Role; me: Card } | { accept: false; block: boolean }
): Promise<void> {
  const { data, error } = await db.rpc('respond_request', {
    request_id: requestId,
    accept: answer.accept,
    my_role: answer.accept ? answer.myRole : null,
    block: answer.accept ? false : answer.block
  });
  if (error) throw new AccountError(friendly(error.message));
  if (answer.accept) await setUpConnection(keys, data as string, answer.me);
}

/** Withdraws a waiting request, or clears one that wasn't accepted. */
export async function withdrawRequest(id: string): Promise<void> {
  const { error } = await db.from('connection_requests').delete().eq('id', id);
  if (error) throw new AccountError(friendly(error.message));
}
