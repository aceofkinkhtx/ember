import { createClient } from '@supabase/supabase-js';
import { pronounLabel } from '../content/identity';
import { defaultPasswordParams, deriveFromPassword, lock, newKeyPair, newRecoveryCode, newSalt, newSecretKey, openSealed, recoveryKey, sealFor, sodium, unlock } from './crypto';
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
export function loadKeys() {
    return readJson(KEYS);
}
export function clearKeys() {
    try {
        window.localStorage.removeItem(KEYS);
    }
    catch {
        // Storage unavailable: nothing was saved.
    }
}
export const MIN_PASSWORD = 10;
/** Plain-language messages for the errors people can actually hit. */
function friendly(message) {
    if (/invalid login credentials/i.test(message))
        return "That email and password don't match an account.";
    if (/email not confirmed/i.test(message))
        return 'Confirm your email first. The link is in your inbox.';
    if (/sending (confirmation|recovery|magic link)? ?email|smtp/i.test(message))
        return "Ember couldn't send the email, so the account wasn't made. Please try again later.";
    if (/connections_roles_fit|fit together/i.test(message))
        return "Those roles don't fit together. One of you needs to Top or S/switch, and the other to bottom or S/switch.";
    if (/personal_codes_code_key|code is taken/i.test(message))
        return 'That code is taken. Try another.';
    if (/personal_codes_code_check/i.test(message))
        return 'Use 4 to 20 letters and numbers, with no spaces.';
    if (/rate limit|too many/i.test(message))
        return 'Too many tries. Wait a few minutes and try again.';
    if (/fetch|network/i.test(message))
        return "Ember can't reach the server. Check your connection and try again.";
    return message;
}
export class AccountError extends Error {
}
const RING = 'ember.profileKeys';
const TOY_RING = 'ember.toyKeys';
const AVATAR = 'ember.avatar';
const SETTINGS = 'ember.settings';
async function finishSignIn(userId, wrapKey, salt) {
    const { data: profile, error } = await db
        .from('profiles')
        .select('wrapped_private_key, sealed_settings')
        .eq('id', userId)
        .maybeSingle();
    if (error)
        throw new AccountError(friendly(error.message));
    if (profile) {
        let privateKey;
        try {
            privateKey = await unlock(profile.wrapped_private_key, wrapKey);
        }
        catch {
            throw new AccountError("Ember couldn't unlock your data with that password.");
        }
        const s = await sodium();
        const publicKey = s.to_base64(s.crypto_scalarmult_base(s.from_base64(privateKey)));
        const keys = { userId, publicKey, privateKey };
        await ensurePublicKey(keys);
        writeJson(KEYS, keys);
        let saved = null;
        if (profile.sealed_settings) {
            try {
                saved = JSON.parse(await openSealed(profile.sealed_settings, keys));
                // A new phone gets the intake keys back.
                if (saved.keyRing && !readJson(RING))
                    writeJson(RING, saved.keyRing);
                if (saved.toyRing && !readJson(TOY_RING))
                    writeJson(TOY_RING, saved.toyRing);
                if (saved.avatar && !readJson(AVATAR))
                    writeJson(AVATAR, saved.avatar);
            }
            catch {
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
    if (insert.error)
        throw new AccountError(friendly(insert.error.message));
    const keys = { userId, ...pair };
    await ensurePublicKey(keys);
    writeJson(KEYS, keys);
    return { kind: 'new', recoveryCode };
}
async function ensurePublicKey(keys) {
    const { data } = await db.from('public_keys').select('user_id').eq('user_id', keys.userId).maybeSingle();
    if (data)
        return;
    const { error } = await db.from('public_keys').insert({ user_id: keys.userId, public_key: keys.publicKey });
    if (error)
        throw new AccountError(friendly(error.message));
}
export async function signUp(email, password) {
    const { authSecret, wrapKey, salt } = await deriveFromPassword(email, password);
    const { data, error } = await db.auth.signUp({
        email: email.trim(),
        password: authSecret,
        options: { emailRedirectTo: `${window.location.origin}/connections` }
    });
    if (error)
        throw new AccountError(friendly(error.message));
    if (!data.session || !data.user)
        return { kind: 'confirm-email' };
    return finishSignIn(data.user.id, wrapKey, salt);
}
export async function signIn(email, password) {
    const { authSecret, wrapKey, salt } = await deriveFromPassword(email, password);
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password: authSecret });
    if (error)
        throw new AccountError(friendly(error.message));
    return finishSignIn(data.user.id, wrapKey, salt);
}
export async function signOut() {
    clearKeys();
    // Intake keys and any unsaved intake belong to this person, not the phone.
    try {
        window.localStorage.removeItem(RING);
        window.localStorage.removeItem(TOY_RING);
        window.localStorage.removeItem('ember.intakeDraft');
        window.localStorage.removeItem('ember.sceneDraft');
        window.localStorage.removeItem('ember.live');
        window.localStorage.removeItem(AVATAR);
    }
    catch {
        // Storage unavailable: nothing was saved.
    }
    await db.auth.signOut({ scope: 'local' });
}
/** A Top setup counts only once someone has actually set something. */
const topIsSet = (top) => Boolean(top?.offerings.setAt || top?.settings.setAt);
/**
 * Saves your setup, locked so only you can open it. Any part not passed in is
 * taken from this phone, then from what was saved before, so saving one part
 * never drops another (and a phone that never set up offerings can't wipe them).
 */
export async function saveProfile(keys, saved = {}) {
    const local = readJson(SETTINGS);
    let before = {};
    const { data } = await db.from('profiles').select('sealed_settings').eq('id', keys.userId).maybeSingle();
    if (data?.sealed_settings) {
        try {
            before = JSON.parse(await openSealed(data.sealed_settings, keys));
        }
        catch {
            before = {};
        }
    }
    const merged = {
        identity: saved.identity ?? local?.identity ?? before.identity,
        top: [saved.top, local?.top].find(topIsSet) ?? before.top,
        keyRing: saved.keyRing ?? readJson(RING) ?? before.keyRing,
        toyRing: saved.toyRing ?? readJson(TOY_RING) ?? before.toyRing,
        // null means removed, so it can't be filled back in from elsewhere.
        avatar: 'avatar' in saved ? saved.avatar : (readJson(AVATAR) ?? before.avatar)
    };
    await db
        .from('profiles')
        .update({ sealed_settings: await sealFor(JSON.stringify(merged), keys.publicKey), updated_at: new Date().toISOString() })
        .eq('id', keys.userId);
}
export async function createInvite(keys, opts) {
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
    if (error)
        throw new AccountError(friendly(error.message));
    const page = opts.kind === 'guest' ? 'guest' : 'join';
    return { code: data.code, link: `${window.location.origin}/${page}/${data.code}#${noteKey}`, expiresAt: data.expires_at };
}
export async function lookupInvite(code, noteKey) {
    const { data, error } = await db.rpc('get_invite', { invite_code: code.trim().toUpperCase() });
    if (error)
        throw new AccountError(friendly(error.message));
    const row = data?.[0];
    if (!row)
        return null;
    let note = null;
    if (noteKey && typeof row.sealed_note === 'string') {
        try {
            note = JSON.parse(await unlock(row.sealed_note, noteKey));
        }
        catch {
            note = null;
        }
    }
    return {
        kind: row.kind,
        inviterRole: row.inviter_role,
        suggestedPath: row.suggested_path ?? null,
        inviterPublicKey: row.inviter_public_key,
        note,
        expired: Boolean(row.expired),
        used: Boolean(row.used)
    };
}
export async function listMyInvites(keys) {
    const { data, error } = await db
        .from('invites')
        .select('id, code, kind, created_at, expires_at, used_at, guest_submissions(sealed_payload)')
        .eq('created_by', keys.userId)
        .order('created_at', { ascending: false });
    if (error)
        throw new AccountError(friendly(error.message));
    return (data ?? []).map((r) => {
        const subs = r.guest_submissions;
        const sub = Array.isArray(subs) ? subs[0] : subs;
        return {
            id: r.id,
            code: r.code,
            kind: r.kind,
            createdAt: r.created_at,
            expiresAt: r.expires_at,
            used: Boolean(r.used_at),
            sealedAnswers: sub?.sealed_payload ?? null
        };
    });
}
export async function cancelInvite(id) {
    const { error } = await db.from('invites').delete().eq('id', id);
    if (error)
        throw new AccountError(friendly(error.message));
}
export async function submitGuestAnswers(code, inviterPublicKey, answers) {
    const payload = await sealFor(JSON.stringify(answers), inviterPublicKey);
    const { error } = await db.rpc('submit_guest', { invite_code: code.trim().toUpperCase(), payload });
    if (error)
        throw new AccountError(friendly(error.message));
}
export async function openGuestAnswers(keys, sealed) {
    try {
        return JSON.parse(await openSealed(sealed, keys));
    }
    catch {
        return null;
    }
}
export function cardFor(identity) {
    const photo = readJson(AVATAR);
    return { name: identity.name.trim(), pronouns: pronounLabel(identity), ...(photo ? { photo } : {}) };
}
/** The usual role opposite someone: a Top's bottom, a bottom's Top, a switch's switch. */
export function complement(role) {
    return role === 'top' ? 'bottom' : role === 'bottom' ? 'top' : 'switch';
}
/** Two Tops or two bottoms can't plan a scene together; anything with a switch can. */
export function rolesFit(a, b) {
    return a !== b || a === 'switch';
}
export async function acceptInvite(keys, code, me, myRole) {
    const { data: connectionId, error } = await db.rpc('accept_invite', { invite_code: code.trim().toUpperCase(), my_role: myRole });
    if (error)
        throw new AccountError(friendly(error.message.replace(/^.*?: /, '')));
    await setUpConnection(keys, connectionId, me);
    return connectionId;
}
/** Makes the connection's shared key, locks a copy for each person, and adds your card. */
async function setUpConnection(keys, connectionId, me) {
    const { data: conn, error } = await db.from('connections').select('user_a, user_b').eq('id', connectionId).single();
    if (error)
        throw new AccountError(friendly(error.message));
    const otherId = conn.user_a === keys.userId ? conn.user_b : conn.user_a;
    const { data: other } = await db.from('public_keys').select('public_key').eq('user_id', otherId).single();
    if (!other)
        throw new AccountError("Ember couldn't find the other person's key. Try again in a moment.");
    const shared = await newSecretKey();
    const keyRows = await db.from('connection_keys').insert([
        { connection_id: connectionId, user_id: keys.userId, wrapped_key: await sealFor(shared, keys.publicKey) },
        { connection_id: connectionId, user_id: otherId, wrapped_key: await sealFor(shared, other.public_key) }
    ]);
    // Already set up from an earlier try: the existing key stays.
    if (keyRows.error && keyRows.error.code !== '23505')
        throw new AccountError(friendly(keyRows.error.message));
    const sharedKey = keyRows.error ? await myConnectionKey(keys, connectionId) : shared;
    if (sharedKey)
        await writeCard(keys, connectionId, sharedKey, me);
}
async function myConnectionKey(keys, connectionId) {
    const { data } = await db
        .from('connection_keys')
        .select('wrapped_key')
        .eq('connection_id', connectionId)
        .eq('user_id', keys.userId)
        .maybeSingle();
    return data ? openSealed(data.wrapped_key, keys) : null;
}
async function writeCard(keys, connectionId, sharedKey, me) {
    await db
        .from('connection_cards')
        .upsert({
        connection_id: connectionId,
        user_id: keys.userId,
        sealed_card: await lock(JSON.stringify(me), sharedKey),
        updated_at: new Date().toISOString()
    });
}
/**
 * Lists your connections and keeps your own card on each one up to date, so a
 * name or pronoun change reaches everyone you play with.
 */
export async function listConnections(keys, me) {
    const [conns, keyRows, cards, accepted] = await Promise.all([
        db.from('connections').select('id, user_a, user_b, role_a, role_b, status, paused_by, created_at').order('created_at', { ascending: false }),
        db.from('connection_keys').select('connection_id, wrapped_key').eq('user_id', keys.userId),
        db.from('connection_cards').select('connection_id, user_id, sealed_card'),
        // Requests you accepted carry the sender's card, locked for you. It stands
        // in until their own card arrives the next time they open Ember.
        db.from('connection_requests').select('from_id, sealed_card').eq('to_id', keys.userId).eq('status', 'accepted')
    ]);
    const failure = conns.error ?? keyRows.error ?? cards.error ?? accepted.error;
    if (failure)
        throw new AccountError(friendly(failure.message));
    const meJson = JSON.stringify(me);
    return Promise.all((conns.data ?? []).map(async (c) => {
        const mySide = c.user_a === keys.userId ? 'a' : 'b';
        const otherId = mySide === 'a' ? c.user_b : c.user_a;
        const myRole = (mySide === 'a' ? c.role_a : c.role_b);
        const theirRole = (mySide === 'a' ? c.role_b : c.role_a);
        const wrapped = keyRows.data?.find((k) => k.connection_id === c.id)?.wrapped_key;
        const base = {
            id: c.id,
            myRole,
            theirRole,
            mySide,
            otherId,
            status: c.status,
            pausedByMe: c.paused_by === keys.userId,
            since: c.created_at
        };
        if (!wrapped)
            return { ...base, them: null, ready: false };
        const shared = await openSealed(wrapped, keys);
        const theirs = cards.data?.find((x) => x.connection_id === c.id && x.user_id === otherId);
        const mine = cards.data?.find((x) => x.connection_id === c.id && x.user_id === keys.userId);
        const myCurrent = mine ? await unlock(mine.sealed_card, shared).catch(() => null) : null;
        if (myCurrent !== meJson && c.status !== 'ended')
            await writeCard(keys, c.id, shared, me);
        let them = null;
        if (theirs) {
            try {
                them = JSON.parse(await unlock(theirs.sealed_card, shared));
            }
            catch {
                them = null;
            }
        }
        const fromRequest = accepted.data?.find((r) => r.from_id === otherId);
        if (!them && fromRequest) {
            try {
                them = JSON.parse(await openSealed(fromRequest.sealed_card, keys));
            }
            catch {
                them = null;
            }
        }
        return { ...base, them, ready: true };
    }));
}
/** Rewrites your card on every connection, so a new name or pronouns show up right away. */
export async function refreshMyCards(keys, me) {
    await listConnections(keys, me);
}
/**
 * Pause, resume or end a connection. Ending is final for both people and
 * withdraws everything either one shared; only a new invite reconnects.
 */
export async function setConnectionStatus(id, status) {
    const { error } = await db.from('connections').update({ status }).eq('id', id);
    if (error)
        throw new AccountError(friendly(error.message));
}
/** Changes your own role in a connection. The other person's role stays theirs to change. */
export async function setMyRole(connection, role) {
    const column = connection.mySide === 'a' ? 'role_a' : 'role_b';
    const { error } = await db.from('connections').update({ [column]: role }).eq('id', connection.id);
    if (error)
        throw new AccountError(friendly(error.message));
}
export async function getMyCode(keys) {
    const { data, error } = await db
        .from('personal_codes')
        .select('code, scene_name, role, active')
        .eq('user_id', keys.userId)
        .maybeSingle();
    if (error)
        throw new AccountError(friendly(error.message));
    return data ? { code: data.code, sceneName: data.scene_name, role: data.role, active: data.active } : null;
}
export function cleanCode(input) {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export async function saveMyCode(keys, code) {
    const { error } = await db.from('personal_codes').upsert({
        user_id: keys.userId,
        code: cleanCode(code.code),
        scene_name: code.sceneName.trim(),
        role: code.role,
        active: code.active
    });
    if (error)
        throw new AccountError(friendly(error.message));
}
/** Keeps the scene name and role shown with your code in step with the Me tab. */
export async function syncMyCode(keys, sceneName, role) {
    if (!sceneName.trim())
        return;
    await db.from('personal_codes').update({ scene_name: sceneName.trim(), role }).eq('user_id', keys.userId);
}
export async function deleteMyCode(keys) {
    const { error } = await db.from('personal_codes').delete().eq('user_id', keys.userId);
    if (error)
        throw new AccountError(friendly(error.message));
}
export async function lookupPersonalCode(code) {
    const { data, error } = await db.rpc('get_personal_code', { personal_code: cleanCode(code) });
    if (error)
        throw new AccountError(friendly(error.message));
    const row = data?.[0];
    return row ? { sceneName: row.scene_name, role: row.role, publicKey: row.owner_public_key } : null;
}
/** Sends your scene name and pronouns, locked so only the code's owner can read them. */
export async function sendRequest(code, owner, myRole, me) {
    const card = await sealFor(JSON.stringify(me), owner.publicKey);
    const { error } = await db.rpc('send_request', { personal_code: cleanCode(code), my_role: myRole, card });
    if (error)
        throw new AccountError(friendly(error.message));
}
export async function listRequests(keys) {
    const { data, error } = await db
        .from('connection_requests')
        .select('id, from_id, to_id, from_role, sealed_card, status, created_at')
        .order('created_at', { ascending: false });
    if (error)
        throw new AccountError(friendly(error.message));
    const rows = data ?? [];
    const incoming = await Promise.all(rows
        .filter((r) => r.to_id === keys.userId && r.status === 'pending')
        .map(async (r) => {
        let from = null;
        try {
            from = JSON.parse(await openSealed(r.sealed_card, keys));
        }
        catch {
            from = null;
        }
        return { id: r.id, fromRole: r.from_role, from, sentAt: r.created_at };
    }));
    const outgoing = rows
        .filter((r) => r.from_id === keys.userId && r.status !== 'accepted')
        .map((r) => ({ id: r.id, status: r.status, sentAt: r.created_at }));
    return { incoming, outgoing };
}
/** Accepting makes the connection and its shared key; declining can also block. */
export async function respondToRequest(keys, requestId, answer) {
    const { data, error } = await db.rpc('respond_request', {
        request_id: requestId,
        accept: answer.accept,
        my_role: answer.accept ? answer.myRole : null,
        block: answer.accept ? false : answer.block
    });
    if (error)
        throw new AccountError(friendly(error.message));
    if (answer.accept)
        await setUpConnection(keys, data, answer.me);
}
/** Withdraws a waiting request, or clears one that wasn't accepted. */
export async function withdrawRequest(id) {
    const { error } = await db.from('connection_requests').delete().eq('id', id);
    if (error)
        throw new AccountError(friendly(error.message));
}
