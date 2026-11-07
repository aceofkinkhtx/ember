import { activities } from '../data/activities';
import { AccountError, db, saveProfile } from './account';
import { lock, newSecretKey, openSealed, sealFor, unlock } from './crypto';
import { readJson, writeJson } from './storage';
export function emptyEssentials() {
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
export function emptyIntake() {
    return { v: 1, essentials: emptyEssentials(), paths: [], quick: null, desireMap: null, myBody: null, detailed: null, aftercare: null, updated: {} };
}
export function emptyDetailed() {
    return {
        answers: {},
        custom: [],
        impact: { areas: [], positions: [], feel: [], marks: null },
        words: { welcome: '', offLimits: '' },
        limits: { hardExtra: '', noTouch: '' }
    };
}
export function emptyAftercare() {
    return { map: null, nextDay: null, extras: [], presence: {}, curiosity: '' };
}
/** What the safety floor needs before an intake can be saved or shared. */
export function essentialsMissing(e) {
    const missing = [];
    if (!e.signals.red.trim() || !e.signals.yellow.trim() || !e.signals.green.trim())
        missing.push('your signal words');
    if (!e.emergency || (e.emergency.kind === 'person' && (!e.emergency.name.trim() || !e.emergency.phone.trim())))
        missing.push('an emergency contact (or Call 911)');
    if (!e.substanceAgreedAt)
        missing.push('the substance agreement');
    return missing;
}
/** Every activity a person can answer, including their own additions. */
export function allActivities(d, body) {
    const list = [...activities, ...(d?.custom ?? [])];
    return body?.frontHole === false ? list.filter((a) => a.anatomy !== 'front-hole') : list;
}
/** No answers fill the limit strip; maybes are soft limits. */
export function limitsOf(intake) {
    const d = intake.detailed;
    if (!d)
        return intake.sharedLimits ?? { hard: [], soft: [] };
    const label = (id) => [...activities, ...d.custom].find((a) => a.id === id)?.label ?? id;
    const hard = Object.entries(d.answers).filter(([, v]) => v.choice === 'no').map(([id]) => label(id));
    const soft = Object.entries(d.answers).filter(([, v]) => v.choice === 'maybe').map(([id]) => label(id));
    return { hard, soft };
}
// The draft on this phone ---------------------------------------------------
const DRAFT = 'ember.intakeDraft';
export function loadDraft() {
    return readJson(DRAFT);
}
export function saveDraft(draft) {
    writeJson(DRAFT, draft);
}
export function clearDraft() {
    try {
        window.localStorage.removeItem(DRAFT);
    }
    catch {
        // Nothing saved.
    }
}
const RING = 'ember.profileKeys';
export function loadRing() {
    return readJson(RING);
}
export function storeRing(ring) {
    writeJson(RING, ring);
}
async function ensureRing(keys, identity) {
    const existing = loadRing();
    if (existing?.gens.length)
        return existing;
    const ring = { gens: [{ g: 1, essentials: await newSecretKey(), full: await newSecretKey() }] };
    storeRing(ring);
    await saveProfile(keys, { identity: identity, keyRing: ring });
    return ring;
}
const current = (ring) => ring.gens[ring.gens.length - 1];
async function sealIntake(intake, gen) {
    const { essentials, ...rest } = intake;
    const sealed = {
        v: 1,
        g: gen.g,
        e: await lock(JSON.stringify({ essentials, sharedLimits: limitsOf(intake) }), gen.essentials),
        f: await lock(JSON.stringify(rest), gen.full)
    };
    return JSON.stringify(sealed);
}
/** Opens what the keys allow. Without the full key, only essentials come back. */
async function openIntake(text, gens) {
    const sealed = JSON.parse(text);
    const gen = gens.find((x) => x.g === sealed.g);
    if (!gen?.essentials)
        return null;
    const { essentials, sharedLimits } = JSON.parse(await unlock(sealed.e, gen.essentials));
    const withDefaults = { ...emptyEssentials(), ...essentials };
    if (!gen.full)
        return { intake: { ...emptyIntake(), essentials: withDefaults, sharedLimits }, full: false };
    const rest = JSON.parse(await unlock(sealed.f, gen.full));
    return { intake: { ...rest, essentials: withDefaults, sharedLimits }, full: true };
}
export async function saveVersion(keys, identity, draft) {
    const missing = essentialsMissing(draft.intake.essentials);
    if (missing.length)
        throw new AccountError(`Please add ${missing.join(', ')} first.`);
    const ring = await ensureRing(keys, identity);
    const { data, error } = await db
        .from('intakes')
        .insert({ owner_id: keys.userId, sealed_intake: await sealIntake(draft.intake, current(ring)), reused_from: draft.basedOn?.id ?? null })
        .select('id, version, created_at, reused_from')
        .single();
    if (error)
        throw new AccountError("Ember couldn't save your intake. Please try again.");
    return { id: data.id, version: data.version, createdAt: data.created_at, reusedFrom: data.reused_from, intake: draft.intake };
}
export async function listVersions(keys) {
    const ring = loadRing();
    const { data, error } = await db
        .from('intakes')
        .select('id, version, created_at, reused_from, sealed_intake')
        .eq('owner_id', keys.userId)
        .order('version', { ascending: false });
    if (error)
        throw new AccountError("Ember couldn't load your intakes.");
    if (!ring)
        return [];
    const out = [];
    for (const r of data ?? []) {
        const opened = await openIntake(r.sealed_intake, ring.gens).catch(() => null);
        if (opened)
            out.push({ id: r.id, version: r.version, createdAt: r.created_at, reusedFrom: r.reused_from, intake: opened.intake });
    }
    return out;
}
export async function deleteVersion(id) {
    const { error } = await db.from('intakes').delete().eq('id', id);
    if (error)
        throw new AccountError("Ember couldn't delete that intake.");
}
export async function listShares(keys) {
    const { data, error } = await db.from('profile_shares').select('recipient_id, scope').eq('owner_id', keys.userId);
    if (error)
        throw new AccountError("Ember couldn't load your sharing settings.");
    return (data ?? []).map((r) => ({ recipientId: r.recipient_id, scope: r.scope }));
}
async function writeShare(keys, ring, share) {
    const { data: pk } = await db.from('public_keys').select('public_key').eq('user_id', share.recipientId).single();
    if (!pk)
        throw new AccountError('Ember can only share with someone you are connected to.');
    const gens = ring.gens.map((g) => (share.scope === 'full' ? g : { g: g.g, essentials: g.essentials }));
    const wrapped = await sealFor(JSON.stringify({ gens }), pk.public_key);
    await db.from('profile_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', share.recipientId);
    const { error } = await db
        .from('profile_shares')
        .insert({ owner_id: keys.userId, recipient_id: share.recipientId, scope: share.scope, wrapped_profile_key: wrapped });
    if (error)
        throw new AccountError("Ember couldn't update sharing. Please try again.");
}
/**
 * Sets what one connection can see: the full profile, essentials only, or
 * nothing (null). Taking access away makes new keys, so anything saved from
 * now on is out of reach for them, and everyone else keeps access.
 */
export async function setShare(keys, identity, recipientId, scope) {
    let ring = await ensureRing(keys, identity);
    const shares = await listShares(keys);
    const before = shares.find((s) => s.recipientId === recipientId)?.scope ?? null;
    const reduced = before === 'full' ? scope !== 'full' : before === 'essentials' ? scope === null : false;
    if (scope === null) {
        const { error } = await db.from('profile_shares').delete().eq('owner_id', keys.userId).eq('recipient_id', recipientId);
        if (error)
            throw new AccountError("Ember couldn't stop sharing. Please try again.");
    }
    if (reduced) {
        const last = current(ring);
        ring = { gens: [...ring.gens, { g: last.g + 1, essentials: await newSecretKey(), full: await newSecretKey() }] };
        storeRing(ring);
        await saveProfile(keys, { identity: identity, keyRing: ring });
    }
    const next = shares.filter((s) => s.recipientId !== recipientId).concat(scope ? [{ recipientId, scope }] : []);
    // After new keys, everyone who still has access gets them; otherwise only this person changes.
    for (const s of reduced ? next : next.filter((x) => x.recipientId === recipientId))
        await writeShare(keys, ring, s);
}
/** The latest intake someone shared with you, as far as your access goes. */
export async function readSharedProfile(keys, ownerId) {
    const { data: share } = await db
        .from('profile_shares')
        .select('wrapped_profile_key')
        .eq('owner_id', ownerId)
        .eq('recipient_id', keys.userId)
        .maybeSingle();
    if (!share)
        return null;
    const { gens } = JSON.parse(await openSealed(share.wrapped_profile_key, keys));
    const { data } = await db
        .from('intakes')
        .select('version, created_at, sealed_intake')
        .eq('owner_id', ownerId)
        .order('version', { ascending: false })
        .limit(1);
    const row = data?.[0];
    if (!row)
        return null;
    const opened = await openIntake(row.sealed_intake, gens).catch(() => null);
    return opened ? { version: row.version, createdAt: row.created_at, full: opened.full, intake: opened.intake } : null;
}
/**
 * Reapplies one change on top of the newest answers. Each tap builds its
 * change from the answers it saw; two quick taps can both see the same old
 * answers, so without this the second would erase the first. Lists merge by
 * what was added and removed, so two chips tapped quickly both stick.
 */
export function mergeChange(base, next, latest) {
    if (Object.is(next, base))
        return latest;
    if (Array.isArray(base) && Array.isArray(next) && Array.isArray(latest)) {
        const added = next.filter((x) => !base.includes(x));
        const removed = base.filter((x) => !next.includes(x));
        return [...latest.filter((x) => !removed.includes(x)), ...added.filter((x) => !latest.includes(x))];
    }
    const isObj = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
    if (isObj(base) && isObj(next) && isObj(latest)) {
        const out = { ...latest };
        for (const k of new Set([...Object.keys(base), ...Object.keys(next)])) {
            if (!(k in next))
                delete out[k];
            else
                out[k] = mergeChange(base[k], next[k], latest[k]);
        }
        return out;
    }
    return next;
}
