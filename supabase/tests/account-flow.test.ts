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

    const { data: cards } = await admin.from('connection_cards').select('sealed_card');
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
});
