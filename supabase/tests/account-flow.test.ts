// @vitest-environment jsdom
// The real account code (src/lib/account.ts) run against the ember-tests
// project with fictional people: keys, recovery code, invites, connection
// cards and a guest reply, all locked before they reach the server.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { vi } from 'vitest';

const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '..', '.env.test'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);

vi.mock('../../src/lib/supabaseConfig', () => ({
  supabaseUrl: env.TEST_SUPABASE_URL,
  supabasePublishableKey: env.TEST_SUPABASE_PUBLISHABLE_KEY
}));

const account = await import('../../src/lib/account');
const { deriveFromPassword } = await import('../../src/lib/crypto');

const admin = createClient(env.TEST_SUPABASE_URL, env.TEST_SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const run = randomBytes(4).toString('hex');
const createdIds: string[] = [];

/** Makes a confirmed account the way sign-up would, without sending email. */
async function makeUser(name: string) {
  const email = `${name}.${run}@example.com`;
  const password = `${name} fictional passphrase`;
  const { authSecret } = await deriveFromPassword(email, password);
  const { data, error } = await admin.auth.admin.createUser({ email, password: authSecret, email_confirm: true });
  if (error) throw error;
  createdIds.push(data.user.id);
  return { email, password, id: data.user.id };
}

afterAll(async () => {
  await account.signOut().catch(() => undefined);
  await Promise.all(createdIds.map((id) => admin.auth.admin.deleteUser(id)));
}, 60_000);

const river = { name: 'River', pronouns: 'they/them' };
const jade = { name: 'Jade', pronouns: 'she/they' };

describe('account flow', () => {
  let riverUser: Awaited<ReturnType<typeof makeUser>>;
  let jadeUser: Awaited<ReturnType<typeof makeUser>>;
  let recovery = '';
  let inviteCode = '';
  let noteKey = '';

  beforeAll(async () => {
    [riverUser, jadeUser] = await Promise.all([makeUser('river'), makeUser('jade')]);
  }, 60_000);

  it('makes keys and a recovery code on first sign-in, and stores only locked keys', async () => {
    const first = await account.signIn(riverUser.email, riverUser.password);
    expect(first.kind).toBe('new');
    if (first.kind === 'new') recovery = first.recoveryCode;
    expect(recovery).toHaveLength(24);

    const keys = account.loadKeys()!;
    const { data } = await admin.from('profiles').select('wrapped_private_key').eq('id', riverUser.id).single();
    expect(data!.wrapped_private_key).not.toContain(keys.privateKey);
  });

  it('unlocks the same keys on the next sign-in, and refuses a wrong password', async () => {
    const before = account.loadKeys()!;
    await account.saveProfile(before, { identity: { name: 'River', pronouns: ['they'], pronounsCustom: '', genders: [], genderCustom: '' } });
    await account.signOut();
    expect(account.loadKeys()).toBeNull();

    await expect(account.signIn(riverUser.email, 'not the passphrase')).rejects.toThrow(/don't match/);
    const again = await account.signIn(riverUser.email, riverUser.password);
    expect(again.kind).toBe('ready');
    if (again.kind === 'ready') expect(again.saved?.identity?.name).toBe('River');
    expect(account.loadKeys()).toEqual(before);
  });

  it('makes an invite whose note only the link can open', async () => {
    const keys = account.loadKeys()!;
    const made = await account.createInvite(keys, {
      kind: 'account',
      role: 'top',
      path: 'words',
      note: { name: 'River', pronouns: 'they/them', message: 'See you Saturday' }
    });
    inviteCode = made.code;
    noteKey = made.link.split('#')[1];
    expect(made.link).toContain(`/join/${made.code}#`);

    const { data } = await admin.from('invites').select('sealed_note').eq('code', made.code).single();
    expect(data!.sealed_note).not.toContain('Saturday');
    expect((await account.lookupInvite(made.code, noteKey))?.note?.message).toBe('See you Saturday');
    expect((await account.lookupInvite(made.code))?.note).toBeNull();
    await account.signOut();
  });

  it('connects Jade, and each sees the other\'s name through the locked cards', async () => {
    const first = await account.signIn(jadeUser.email, jadeUser.password);
    expect(first.kind).toBe('new');
    const jadeKeys = account.loadKeys()!;
    await account.acceptInvite(jadeKeys, inviteCode, jade, 'bottom');
    const jadeView = await account.listConnections(jadeKeys, jade);
    expect(jadeView).toHaveLength(1);
    expect(jadeView[0].myRole).toBe('bottom');
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    const riverView = await account.listConnections(riverKeys, river);
    expect(riverView[0].them).toEqual(jade);
    expect(riverView[0].myRole).toBe('top');

    const { data: cards } = await admin.from('connection_cards').select('sealed_card').in('user_id', [riverUser.id, jadeUser.id]);
    expect(cards!.length).toBe(2);
    cards!.forEach((c) => expect(c.sealed_card).not.toMatch(/Jade|River/));
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    expect((await account.listConnections(account.loadKeys()!, jade))[0].them).toEqual(river);
    await account.signOut();
  });

  it('shows a new name to the other person as soon as it changes', async () => {
    await account.signIn(jadeUser.email, jadeUser.password);
    await account.refreshMyCards(account.loadKeys()!, { name: 'Jade Rivers', pronouns: 'they/them' });
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    expect((await account.listConnections(account.loadKeys()!, river))[0].them).toEqual({ name: 'Jade Rivers', pronouns: 'they/them' });
    await account.signOut();
  });

  it('connects through a personal code and an accepted request, with names locked on the way', async () => {
    const solUser = await makeUser('sol');
    const sol = { name: 'Sol', pronouns: 'he/they' };
    const code = `SOL${run}`.toUpperCase();
    await account.signIn(solUser.email, solUser.password);
    await account.saveMyCode(account.loadKeys()!, { code, sceneName: 'Sol', role: 'switch', active: true });
    await account.signOut();

    const owner = await account.lookupPersonalCode(code.toLowerCase());
    expect(owner).toMatchObject({ sceneName: 'Sol', role: 'switch' });

    await account.signIn(riverUser.email, riverUser.password);
    await account.sendRequest(code, owner!, 'switch', river);
    const { data: raw } = await admin.from('connection_requests').select('sealed_card').eq('to_id', solUser.id).single();
    expect(raw!.sealed_card).not.toContain('River');
    await account.signOut();

    await account.signIn(solUser.email, solUser.password);
    const solKeys = account.loadKeys()!;
    const { incoming } = await account.listRequests(solKeys);
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ fromRole: 'switch', from: river });
    await account.respondToRequest(solKeys, incoming[0].id, { accept: true, myRole: 'switch', me: sol });
    const solView = await account.listConnections(solKeys, sol);
    expect(solView[0]).toMatchObject({ myRole: 'switch', theirRole: 'switch' });
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    const riverView = await account.listConnections(account.loadKeys()!, river);
    expect(riverView.find((c) => c.them?.name === 'Sol')).toMatchObject({ them: sol, myRole: 'switch' });
    await account.signOut();
  });

  it('shares an intake as essentials only or in full, and revoking locks out what comes next', async () => {
    const intakeLib = await import('../../src/lib/intake');
    const jadeIdentity = { name: 'Jade', pronouns: ['she', 'they'], pronounsCustom: '', genders: [], genderCustom: '' };

    await account.signIn(jadeUser.email, jadeUser.password);
    const jadeKeys = account.loadKeys()!;
    const intake = intakeLib.emptyIntake();
    intake.essentials.emergency = { kind: '911' };
    intake.essentials.substanceAgreedAt = new Date().toISOString();
    intake.essentials.triggers.notes = 'Hands near my throat';
    intake.detailed = { ...intakeLib.emptyDetailed(), answers: { gag: { choice: 'no' }, rope: { choice: 'yes', intensity: 3 } } };
    const saved = await intakeLib.saveVersion(jadeKeys, jadeIdentity, { intake, basedOn: null });
    expect(saved.version).toBeGreaterThan(0);

    const { data: raw } = await admin.from('intakes').select('sealed_intake').eq('id', saved.id).single();
    expect(raw!.sealed_intake).not.toMatch(/throat|gag|rope/);

    await intakeLib.setShare(jadeKeys, jadeIdentity, riverUser.id, 'essentials');
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    const essentialsOnly = await intakeLib.readSharedProfile(account.loadKeys()!, jadeUser.id);
    expect(essentialsOnly).toMatchObject({ full: false });
    expect(essentialsOnly!.intake.essentials.triggers.notes).toBe('Hands near my throat');
    expect(essentialsOnly!.intake.detailed).toBeNull();
    // Limits travel with essentials, so even essentials-only sharing shows every no.
    expect(intakeLib.limitsOf(essentialsOnly!.intake).hard).toEqual(['Gags']);
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    await intakeLib.setShare(account.loadKeys()!, jadeIdentity, riverUser.id, 'full');
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    const full = await intakeLib.readSharedProfile(account.loadKeys()!, jadeUser.id);
    expect(full!.full).toBe(true);
    expect(intakeLib.limitsOf(full!.intake).hard).toEqual(['Gags']);
    await account.signOut();

    // A new phone gets the intake keys back at sign-in.
    await account.signIn(jadeUser.email, jadeUser.password);
    expect(intakeLib.loadRing()?.gens).toHaveLength(1);
    await intakeLib.setShare(account.loadKeys()!, jadeIdentity, riverUser.id, null);
    expect(intakeLib.loadRing()?.gens).toHaveLength(2);
    const later = await intakeLib.saveVersion(account.loadKeys()!, jadeIdentity, { intake, basedOn: { id: saved.id, version: saved.version } });
    expect(later.reusedFrom).toBe(saved.id);
    const mine = await intakeLib.listVersions(account.loadKeys()!);
    expect(mine.map((v) => v.version)).toEqual([later.version, saved.version]);
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    expect(await intakeLib.readSharedProfile(account.loadKeys()!, jadeUser.id)).toBeNull();
    await account.signOut();
  });

  it('keeps toys and photos locked, shares them with one connection, and new keys after stopping', async () => {
    const toysLib = await import('../../src/lib/toys');
    const shown: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      shown.push(b);
      return `blob:toy-${shown.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    const photo = new Uint8Array([255, 216, 255, 9, 8, 7, 6, 5]);

    await account.signIn(jadeUser.email, jadeUser.password);
    const jadeKeys = account.loadKeys()!;
    const flogger = await toysLib.saveToy(
      jadeKeys,
      { details: { ...toysLib.emptyToy(), name: 'Suede flogger', feel: ['thuddy'], types: ['impact'], notes: 'Soft falls' } },
      photo
    );
    expect(flogger.photoGen).toBe(1);
    const { data: raw } = await admin.from('toys').select('sealed_toy').eq('id', flogger.id).single();
    expect(raw!.sealed_toy).not.toMatch(/Suede|flogger|thuddy|Soft/);
    const stored = await admin.storage.from('toy-photos').download(`${jadeUser.id}/${flogger.id}`);
    expect(new Uint8Array(await stored.data!.arrayBuffer())).not.toEqual(photo);

    const conn = (await account.listConnections(jadeKeys, { name: 'Jade', pronouns: 'she/they' })).find((c) => c.otherId === riverUser.id)!;
    const cuffs = await toysLib.saveToy(jadeKeys, { details: { ...toysLib.emptyToy(), name: 'Leather cuffs', types: ['bondage'] } });
    await toysLib.setOptOut(conn.id, cuffs.id, true);
    await toysLib.setToyShare(jadeKeys, riverUser.id, true);
    expect((await toysLib.listMyToys(jadeKeys)).map((t) => t.name)).toEqual(['Leather cuffs', 'Suede flogger']);
    await account.signOut();
    expect(toysLib.loadToyRing()).toBeNull();

    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    expect(await toysLib.theyShareToys(riverKeys, jadeUser.id)).toBe(true);
    const theirs = await toysLib.readTheirToys(riverKeys, jadeUser.id);
    expect(theirs!.toys.map((t) => t.name)).toEqual(['Leather cuffs', 'Suede flogger']);
    expect((await toysLib.listOptOuts()).filter((o) => o.connectionId === conn.id)).toEqual([{ connectionId: conn.id, toyId: cuffs.id }]);
    const seen = theirs!.toys.find((t) => t.name === 'Suede flogger')!;
    expect(await toysLib.photoUrl(seen, theirs!.gens)).toMatch(/^blob:toy-/);
    expect(new Uint8Array(await shown[shown.length - 1].arrayBuffer())).toEqual(photo);
    await account.signOut();

    // A new phone gets the toy keys back; stopping makes new ones.
    await account.signIn(jadeUser.email, jadeUser.password);
    expect(toysLib.loadToyRing()?.gens).toHaveLength(1);
    await toysLib.setToyShare(account.loadKeys()!, riverUser.id, false);
    expect(toysLib.loadToyRing()?.gens).toHaveLength(2);
    const later = await toysLib.saveToy(account.loadKeys()!, { details: { ...toysLib.emptyToy(), name: 'Wartenberg wheel' } });
    expect((await toysLib.listMyToys(account.loadKeys()!)).map((t) => t.name)).toEqual(['Leather cuffs', 'Suede flogger', 'Wartenberg wheel']);
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    expect(await toysLib.readTheirToys(account.loadKeys()!, jadeUser.id)).toBeNull();
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    for (const t of await toysLib.listMyToys(account.loadKeys()!)) await toysLib.deleteToy(account.loadKeys()!, t);
    expect((await admin.from('toys').select('id').in('id', [flogger.id, cuffs.id, later.id])).data).toEqual([]);
    expect((await admin.storage.from('toy-photos').list(jadeUser.id)).data).toEqual([]);
    await account.signOut();
  });

  it("keeps a Top's offerings and settings with the account", async () => {
    const { emptyTopSetup } = await import('../../src/content/topSetup');
    const top = emptyTopSetup();
    top.offerings.categories = { impact: { on: true, min: 2, max: 7 } };
    top.settings.voice = 'Steady and warm';
    top.settings.setAt = new Date().toISOString();
    await account.signIn(riverUser.email, riverUser.password);
    await account.saveProfile(account.loadKeys()!, { top });
    // Saving another part later keeps it.
    await account.saveProfile(account.loadKeys()!, { identity: { name: 'River', pronouns: ['they'], pronounsCustom: '', genders: [], genderCustom: '' } });
    await account.signOut();
    const again = await account.signIn(riverUser.email, riverUser.password);
    expect(again.kind === 'ready' && again.saved?.top?.settings.voice).toBe('Steady and warm');
    expect(again.kind === 'ready' && again.saved?.top?.offerings.categories.impact).toEqual({ on: true, min: 2, max: 7 });
    await account.signOut();
  });

  it('carries a guest answer to the inviter, locked for them alone', async () => {
    await account.signIn(riverUser.email, riverUser.password);
    const keys = account.loadKeys()!;
    const made = await account.createInvite(keys, { kind: 'guest', role: 'top', path: 'detailed', note: { name: 'River', pronouns: '', message: '' } });
    expect(made.code).toHaveLength(24);
    await account.signOut();

    // The guest has no account.
    const info = await account.lookupInvite(made.code, made.link.split('#')[1]);
    await account.submitGuestAnswers(made.code, info!.inviterPublicKey, {
      name: 'Sol',
      pronouns: 'he/they',
      message: 'Nervous but excited',
      adultConfirmedAt: new Date().toISOString()
    });

    await account.signIn(riverUser.email, riverUser.password);
    const mine = await account.listMyInvites(account.loadKeys()!);
    const guest = mine.find((i) => i.code === made.code)!;
    expect(guest.sealedAnswers).not.toContain('Sol');
    expect((await account.openGuestAnswers(account.loadKeys()!, guest.sealedAnswers!))?.message).toBe('Nervous but excited');
  });

  it('locks a profile picture, and hands its key to connections inside their card', async () => {
    await account.signOut();
    const avatar = await import('../../src/lib/avatar');
    const shown: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      shown.push(b);
      return `blob:avatar-${shown.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    const picture = new Uint8Array([255, 216, 255, 1, 2, 3, 4]);

    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    const key = await avatar.setAvatar(riverKeys, picture);
    await account.refreshMyCards(riverKeys, account.cardFor({ name: 'River', pronouns: ['they'], pronounsCustom: '', genders: [], genderCustom: '' }));
    const { data: raw } = await admin.storage.from('avatars').download(`${riverUser.id}/avatar`);
    expect(new Uint8Array(await raw!.arrayBuffer())).not.toEqual(picture);
    await account.signOut();
    // Signing out leaves no picture key on the phone.
    expect(avatar.loadAvatarKey()).toBeNull();

    await account.signIn(jadeUser.email, jadeUser.password);
    const conn = (await account.listConnections(account.loadKeys()!, jade)).find((c) => c.otherId === riverUser.id)!;
    expect(conn.them?.photo).toEqual(key);
    expect(await avatar.avatarUrl(riverUser.id, conn.them!.photo!)).toBe('blob:avatar-1');
    expect(new Uint8Array(await shown[0].arrayBuffer())).toEqual(picture);
    await account.signOut();

    // A new phone gets the key back with the profile, and removing clears it everywhere.
    await account.signIn(riverUser.email, riverUser.password);
    expect(avatar.loadAvatarKey()).toEqual(key);
    await avatar.removeAvatar(account.loadKeys()!);
    expect((await admin.storage.from('avatars').list(riverUser.id)).data).toEqual([]);
    await account.signOut();
    await account.signIn(riverUser.email, riverUser.password);
    expect(avatar.loadAvatarKey()).toBeNull();
  });

  it('shares a SceneVibe locked for the bottom, and sends the plan only when the Top chooses', async () => {
    await account.signOut();
    const scenes = await import('../../src/lib/scenes');
    const vibes = await import('../../src/lib/vibes');
    const { design } = await import('../../src/lib/scene/designer');
    const { emptyTopSetup } = await import('../../src/content/topSetup');
    const intakeLib = await import('../../src/lib/intake');

    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    const conn = (await account.listConnections(riverKeys, river)).find((c) => c.otherId === jadeUser.id)!;
    const intake = intakeLib.emptyIntake();
    intake.detailed = { ...intakeLib.emptyDetailed(), answers: { flogger: { choice: 'yes' }, wax: { choice: 'yes' } } };
    const top = emptyTopSetup();
    for (const c of ['impact', 'sensation'] as const) top.offerings.categories[c] = { on: true, min: 1, max: 8 };
    const ctx = { intake, top, optedOutGear: [], gear: [] };
    const scene = design('climb', {
      title: 'Ember night', connectionId: conn.id, partnerId: jadeUser.id, partnerName: 'Jade', role: 'top',
      date: '2026-12-01', startTime: '20:00', minutes: 60, location: '', isPublic: false, intense: false, intakeVersion: 1, marks: 'day',
      useSpecificGear: false, gearIds: [], overrides: [], notes: '',
      picks: [{ activityId: 'flogger', intensity: 6, surprise: false }, { activityId: 'wax', intensity: 5, surprise: true }]
    }, ctx);
    const shared = await vibes.shareVibe(riverKeys, await scenes.saveScene(riverKeys, scene), {});
    const { data: raw } = await admin.from('scene_vibes').select('sealed_vibe').eq('id', shared.share!.id).single();
    expect(raw!.sealed_vibe).not.toMatch(/Ember night|flogger|impact/);
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    let mine = await vibes.listSharedVibes(account.loadKeys()!);
    expect(mine.map((v) => v.vibe.title)).toEqual(['Ember night']);
    expect(mine[0].vibe.surprises).toBe(1);
    expect(JSON.stringify(mine[0].vibe)).not.toMatch(/flogger|Floggers|wax/i);
    expect(mine[0].plan).toBeNull();
    await vibes.requestPlan(mine[0].id);
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    const state = await vibes.vibePlanState(shared);
    expect(vibes.planStatus(state!)).toBe('requested');
    await vibes.sendPlan(shared, false);
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    mine = await vibes.listSharedVibes(account.loadKeys()!);
    expect(vibes.planStatus(mine[0])).toBe('sent');
    const plan = JSON.stringify(mine[0].plan);
    expect(plan).toContain('flogger');
    // The surprise stays a surprise.
    expect(plan).not.toContain('wax');
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    await scenes.deleteScene(shared.id);
    expect((await admin.from('scene_vibes').select('id').eq('id', shared.share!.id)).data).toEqual([]);
  });

  it('runs the pre-scene check and live scene between two phones, all locked (M6)', async () => {
    await account.signOut();
    const scenes = await import('../../src/lib/scenes');
    const vibes = await import('../../src/lib/vibes');
    const liveSync = await import('../../src/lib/liveSync');
    const live = await import('../../src/lib/scene/live');
    const { design } = await import('../../src/lib/scene/designer');
    const { emptyTopSetup } = await import('../../src/content/topSetup');
    const intakeLib = await import('../../src/lib/intake');

    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    const conn = (await account.listConnections(riverKeys, river)).find((c) => c.otherId === jadeUser.id)!;
    const intake = intakeLib.emptyIntake();
    intake.detailed = { ...intakeLib.emptyDetailed(), answers: { flogger: { choice: 'yes' }, wax: { choice: 'maybe' } } };
    const top = emptyTopSetup();
    for (const c of ['impact', 'sensation'] as const) top.offerings.categories[c] = { on: true, min: 1, max: 8 };
    const ctx = { intake, top, optedOutGear: [], gear: [] };
    const scene = design('climb', {
      title: 'Live night', connectionId: conn.id, partnerId: jadeUser.id, partnerName: 'Jade', role: 'top',
      date: '2026-12-02', startTime: '20:00', minutes: 60, location: '', isPublic: false, intense: false, intakeVersion: 1, marks: 'day',
      useSpecificGear: false, gearIds: [], overrides: [], notes: '',
      picks: [{ activityId: 'flogger', intensity: 6, surprise: false }, { activityId: 'wax', intensity: 5, surprise: true }]
    }, ctx);
    const shared = await vibes.shareVibe(riverKeys, await scenes.saveScene(riverKeys, scene), {});
    const maybes = live.maybesIn(shared, ctx);
    expect(maybes.map((m) => m.activityId)).toEqual(['wax']);
    await liveSync.sendCheck(shared.share!.id, jadeUser.id, { maybes, askedAt: new Date().toISOString() });
    const { data: raw } = await admin.from('scene_vibes').select('sealed_check').eq('id', shared.share!.id).single();
    expect(raw!.sealed_check).not.toMatch(/wax|Wax/);
    await account.signOut();

    // The bottom sees the maybe by name, and says no.
    await account.signIn(jadeUser.email, jadeUser.password);
    const mine = (await vibes.listSharedVibes(account.loadKeys()!)).find((v) => v.vibe.title === 'Live night')!;
    expect(mine.check?.maybes.map((m) => m.activityId)).toEqual(['wax']);
    expect(mine.answered).toBe(false);
    const answer = { ...live.emptyBottomCheck(), feeling: 4, excitement: 5, body: 4, emotion: 4, finalNegotiation: true, substanceToday: true, maybes: { wax: 'no' as const }, answeredAt: new Date().toISOString() };
    await liveSync.answerCheck(mine.id, riverUser.id, answer);
    await account.signOut();

    // The Top reads it, starts, and the bottom's red reaches the Top's phone.
    await account.signIn(riverUser.email, riverUser.password);
    const got = await liveSync.readFromBottom(account.loadKeys()!, shared.share!.id);
    expect(got?.answer?.maybes).toEqual({ wax: 'no' });
    const planned = live.removeActivities(shared, ['wax']);
    expect(JSON.stringify(planned.phases)).not.toContain('"wax"');
    const running = live.startLive(planned, ctx, { care: live.careInfo(intake) } as never, new Date().toISOString());
    expect(await liveSync.sendLive(shared.share!.id, jadeUser.id, running)).toBe(true);
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    const clock = await liveSync.readLive(account.loadKeys()!, shared.share!.id);
    expect(clock?.startedAt).toBe(running.startedAt);
    expect(JSON.stringify(clock)).not.toMatch(/flogger|snapshot|care/);
    await liveSync.sendSignal(shared.share!.id, riverUser.id, { red: new Date().toISOString(), yellows: [] });
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    expect((await liveSync.readFromBottom(account.loadKeys()!, shared.share!.id))?.signal?.red).toBeTruthy();
    await scenes.deleteScene(shared.id);
  });

  it('runs the after-scene check-ins, debriefs and messages between two phones, all locked (M7)', async () => {
    await account.signOut();
    const scenes = await import('../../src/lib/scenes');
    const vibes = await import('../../src/lib/vibes');
    const after = await import('../../src/lib/afterScene');
    const messages = await import('../../src/lib/messages');
    const { design } = await import('../../src/lib/scene/designer');
    const { emptyTopSetup } = await import('../../src/content/topSetup');
    const intakeLib = await import('../../src/lib/intake');

    // The Top's scene ends: check-ins are scheduled for both, and the Top's private answers stay private.
    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    const conn = (await account.listConnections(riverKeys, river)).find((c) => c.otherId === jadeUser.id)!;
    const intake = intakeLib.emptyIntake();
    intake.detailed = { ...intakeLib.emptyDetailed(), answers: { flogger: { choice: 'yes' } } };
    const top = emptyTopSetup();
    top.offerings.categories.impact = { on: true, min: 1, max: 8 };
    const scene = design('climb', {
      title: 'After night', connectionId: conn.id, partnerId: jadeUser.id, partnerName: 'Jade', role: 'top',
      date: '2026-12-03', startTime: '20:00', minutes: 45, location: '', isPublic: false, intense: false, intakeVersion: 1, marks: 'day',
      useSpecificGear: false, gearIds: [], overrides: [], notes: '', picks: [{ activityId: 'flogger', intensity: 6, surprise: false }]
    }, { intake, top, optedOutGear: [], gear: [] });
    const shared = await vibes.shareVibe(riverKeys, await scenes.saveScene(riverKeys, scene), {});
    const vibeId = shared.share!.id;
    await after.scheduleAfterScene(vibeId);
    expect(after.dueNow(await after.listReminders()).map((r) => r.kind)).toEqual(['post']);
    await after.saveNote(riverKeys, vibeId, jadeUser.id, 'post', 0, { feeling: 2, attentiveness: 5, overall: 5 }, { activities: [{ id: 'flogger', label: 'Flogger' }] });
    await after.markDone(vibeId, 'post');
    expect(after.dueNow(await after.listReminders())).toEqual([]);
    const { data: raw } = await admin.from('scene_notes').select('sealed_self, sealed_shared').eq('vibe_id', vibeId);
    expect(JSON.stringify(raw)).not.toMatch(/flogger|Flogger|feeling/);
    await account.signOut();

    // The bottom sees the Top's activity list, not the Top's ratings, and answers.
    await account.signIn(jadeUser.email, jadeUser.password);
    const jadeKeys = account.loadKeys()!;
    let notes = await after.listNotes(jadeKeys, vibeId);
    const fromTop = after.find(notes, riverUser.id, 'post')!;
    expect(fromTop.shared).toEqual({ activities: [{ id: 'flogger', label: 'Flogger' }] });
    expect(fromTop.mine).toBeNull();
    expect(after.dueNow(await after.listReminders()).map((r) => r.kind)).toEqual(['post']);
    await after.saveNote(jadeKeys, vibeId, riverUser.id, 'post', 0, { feeling: 4, attentiveness: 5, overall: 4 }, { feeling: 4, attentiveness: 5, overall: 4 });
    await after.saveNote(jadeKeys, vibeId, riverUser.id, 'debrief', 0, { scores: { 'feel-now': 4 }, differed: '', keep: 'The slow start', replies: { flogger: 'no-now' } }, { scores: { 'feel-now': 4 }, differed: '', keep: 'The slow start', replies: { flogger: 'no-now' } });
    notes = await after.listNotes(jadeKeys, vibeId);
    expect(after.find<{ keep: string }>(notes, jadeUser.id, 'debrief')?.mine?.keep).toBe('The slow start');

    // A message arrives sealed: the server never holds the words.
    await messages.sendMessage(jadeKeys, conn.id, riverUser.id, { text: 'Thank you for tonight' });
    const { data: msgRaw } = await admin.from('messages').select('sealed_for_recipient, sealed_for_sender').eq('connection_id', conn.id);
    expect(JSON.stringify(msgRaw)).not.toContain('Thank you');
    expect((await messages.listThread(jadeKeys, conn.id)).map((m) => [m.text, m.mine])).toEqual([['Thank you for tonight', true]]);
    await account.signOut();

    // The Top reads the bottom's debrief and message, and sends the 18-hour check-in.
    await account.signIn(riverUser.email, riverUser.password);
    const topKeys = account.loadKeys()!;
    notes = await after.listNotes(topKeys, vibeId);
    expect((after.find(notes, jadeUser.id, 'debrief')?.shared as { replies: Record<string, string> }).replies).toEqual({ flogger: 'no-now' });
    expect((await messages.unreadCounts(topKeys))[conn.id]).toBe(1);
    expect((await messages.listThread(topKeys, conn.id))[0].text).toBe('Thank you for tonight');
    await messages.markRead(topKeys, conn.id);
    expect((await messages.unreadCounts(topKeys))[conn.id]).toBeUndefined();
    await messages.sendMessage(topKeys, conn.id, jadeUser.id, { text: 'How are you feeling today?', kind: 'checkin' });
    await after.markDone(vibeId, 'checkin');
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    const thread = await messages.listThread(account.loadKeys()!, conn.id);
    expect(thread.map((m) => m.kind ?? 'text')).toEqual(['text', 'checkin']);
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    await scenes.deleteScene(shared.id);
  });

  it("sends a design from bottom to Top as a locked request, accepted into the Top's own scenes", async () => {
    await account.signOut();
    const scenes = await import('../../src/lib/scenes');
    const { design } = await import('../../src/lib/scene/designer');
    const { openSetup } = await import('../../src/state/sceneContext');
    const intakeLib = await import('../../src/lib/intake');

    await account.signIn(jadeUser.email, jadeUser.password);
    const jadeKeys = account.loadKeys()!;
    const conn = (await account.listConnections(jadeKeys, jade)).find((c) => c.otherId === riverUser.id)!;
    const intake = intakeLib.emptyIntake();
    intake.detailed = { ...intakeLib.emptyDetailed(), answers: { 'bare-hand': { choice: 'yes' }, cuddling: { choice: 'yes' } } };
    const ctx = { intake, top: openSetup(), optedOutGear: [], gear: [] };
    const mine = design('climb', {
      title: 'Velvet Saturday', connectionId: conn.id, partnerId: riverUser.id, partnerName: 'River', role: 'bottom',
      date: '', startTime: '', minutes: 45, location: '', isPublic: false, intense: false, intakeVersion: 1, marks: 'none',
      useSpecificGear: false, gearIds: [], picks: [{ activityId: 'bare-hand', intensity: 5, surprise: false }], overrides: [], notes: ''
    }, ctx);
    await scenes.saveScene(jadeKeys, mine);
    const sent = await scenes.sendSceneRequest(jadeKeys, mine);
    expect(sent.request?.status).toBe('sent');
    const { data: raw } = await admin.from('scene_requests').select('sealed_scene').eq('id', sent.request!.id).single();
    expect(raw!.sealed_scene).not.toMatch(/Velvet|River|bare-hand/);
    await account.signOut();

    await account.signIn(riverUser.email, riverUser.password);
    const riverKeys = account.loadKeys()!;
    const incoming = await scenes.listIncomingRequests(riverKeys);
    expect(incoming.map((r) => r.scene.title)).toEqual(['Velvet Saturday']);
    const copy = { ...incoming[0].scene, id: crypto.randomUUID(), role: 'top' as const, partnerId: jadeUser.id };
    await scenes.acceptSceneRequest(riverKeys, incoming[0], copy);
    expect((await scenes.listScenes(riverKeys)).map((s) => s.title)).toContain('Velvet Saturday');
    expect(await scenes.listIncomingRequests(riverKeys)).toEqual([]);
    for (const s of await scenes.listScenes(riverKeys)) await scenes.deleteScene(s.id);
    await account.signOut();

    await account.signIn(jadeUser.email, jadeUser.password);
    expect((await scenes.sentRequestStatuses(account.loadKeys()!))[sent.request!.id]).toBe('accepted');
    for (const s of await scenes.listScenes(account.loadKeys()!)) await scenes.deleteScene(s.id);
  });
  it("exports what you can read, then deletes the account, its rows and its photo files, but keeps reports about it (M9)", async () => {
    await account.signOut();
    const myData = await import("../../src/lib/myData");
    const messages = await import("../../src/lib/messages");
    const toys = await import("../../src/lib/toys");
    const avatar = await import("../../src/lib/avatar");
    const { defaultSettings } = await import("../../src/state/settings");

    // Jade has a picture, gear with a photo, and a message to River.
    await account.signIn(jadeUser.email, jadeUser.password);
    const jadeKeys = account.loadKeys()!;
    const conn = (await account.listConnections(jadeKeys, jade)).find((c) => c.otherId === riverUser.id)!;
    await avatar.setAvatar(jadeKeys, new Uint8Array([1, 2, 3]));
    await toys.saveToy(jadeKeys, { details: { ...toys.emptyToy(), name: "Soft rope" } }, new Uint8Array([4, 5, 6]));
    await messages.sendMessage(jadeKeys, conn.id, riverUser.id, { text: "See you Saturday" });

    const data = await myData.collectMyData(jadeKeys, { ...defaultSettings, identity: { ...defaultSettings.identity, name: "Jade" } });
    expect(data.account.email).toBe(jadeUser.email);
    expect(data.gear.map((g) => g.name)).toContain("Soft rope");
    expect(data.connections.find((c) => c.messages.some((m) => m.text === "See you Saturday" && m.from === "you"))).toBeTruthy();
    expect(JSON.stringify(data.onThisPhone)).not.toMatch(/hash|salt/);
    await account.signOut();

    // River reports Jade.
    await account.signIn(riverUser.email, riverUser.password);
    await messages.report(account.loadKeys()!, jadeUser.id, "spam", "Fictional test report", []);
    await account.signOut();

    // Jade deletes the account.
    await account.signIn(jadeUser.email, jadeUser.password);
    await myData.deleteMyAccount(account.loadKeys()!);
    expect(account.loadKeys()).toBeNull();

    const { data: gone } = await admin.auth.admin.getUserById(jadeUser.id);
    expect(gone.user).toBeNull();
    for (const [table, column] of [["profiles", "id"], ["toys", "owner_id"], ["intakes", "owner_id"], ["messages", "sender_id"], ["scene_notes", "author_id"], ["personal_codes", "user_id"]] as const) {
      const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, jadeUser.id);
      expect([table, count]).toEqual([table, 0]);
    }
    const { count: conns } = await admin.from("connections").select("*", { count: "exact", head: true }).eq("id", conn.id);
    expect(conns).toBe(0);
    for (const bucket of ["toy-photos", "avatars"]) {
      const { data: files } = await admin.storage.from(bucket).list(jadeUser.id);
      expect([bucket, (files ?? []).length]).toEqual([bucket, 0]);
    }
    const { data: reports } = await admin.from("reports").select("reported_id, details").eq("reporter_id", riverUser.id);
    expect(reports).toEqual([{ reported_id: null, details: "Fictional test report" }]);
    await admin.from("reports").delete().eq("reporter_id", riverUser.id);
  });
});
