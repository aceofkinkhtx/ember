// @vitest-environment jsdom
// Password reset and change (src/lib/account.ts) against the ember-tests
// project with a fictional person. Kept apart from account-flow.test.ts so
// each file stays under the project's sign-in rate limit.

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

describe('password reset', () => {
  it('resets a forgotten password with the emailed link and the recovery code, keeping the same keys, and changes it while signed in', async () => {
    await account.signOut();
    const wren = await makeUser('wren');
    const first = await account.signIn(wren.email, wren.password);
    if (first.kind !== 'new') throw new Error('expected a new account');
    const before = account.loadKeys()!;
    await account.saveProfile(before, { identity: { name: 'Wren', pronouns: ['they'], pronounsCustom: '', genders: [], genderCustom: '' } });
    await account.signOut();

    // What the emailed link does: a short-lived session for that email, and no keys.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email: wren.email });
    if (linkError) throw linkError;
    const opened = await account.db.auth.verifyOtp({ type: 'recovery', token_hash: link.properties.hashed_token });
    if (opened.error) throw opened.error;
    expect(await account.resetLinkEmail()).toBe(wren.email);

    // A wrong code changes nothing.
    const lockedBefore = (await admin.from('profiles').select('wrapped_private_key').eq('id', wren.id).single()).data!.wrapped_private_key;
    await expect(account.resetWithRecoveryCode('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', 'wren new fictional passphrase')).rejects.toThrow(/doesn't match/);
    expect((await admin.from('profiles').select('wrapped_private_key').eq('id', wren.id).single()).data!.wrapped_private_key).toBe(lockedBefore);

    // The right code, typed loosely, unlocks the same keys and the saved profile.
    const loose = first.recoveryCode.toLowerCase().replace(/(.{4})/g, '$1 ');
    const reset = await account.resetWithRecoveryCode(loose, 'wren new fictional passphrase');
    expect(reset.kind).toBe('ready');
    if (reset.kind === 'ready') expect(reset.saved?.identity?.name).toBe('Wren');
    expect(account.loadKeys()!.privateKey).toBe(before.privateKey);

    await account.signOut();
    await expect(account.signIn(wren.email, wren.password)).rejects.toThrow(/don't match/);
    await account.signIn(wren.email, 'wren new fictional passphrase');
    const keys = account.loadKeys()!;
    expect(keys.privateKey).toBe(before.privateKey);

    // Changing it while signed in needs the current password.
    await expect(account.changePassword(keys, wren.email, 'not my password', 'wren third fictional passphrase')).rejects.toThrow(/isn't right/);
    await account.changePassword(keys, wren.email, 'wren new fictional passphrase', 'wren third fictional passphrase');
    await account.signOut();
    await account.signIn(wren.email, 'wren third fictional passphrase');
    expect(account.loadKeys()!.privateKey).toBe(before.privateKey);
    await account.signOut();
  });

});
