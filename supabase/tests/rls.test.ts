// Privacy rules, tested against the separate ember-tests project with
// fictional people only. Run with: npm run test:db
//
// Each test signs in as one person and tries to reach another person's data.
// Every attempt that should fail must fail.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '..', '.env.test'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.TEST_SUPABASE_URL;
const publishable = env.TEST_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, env.TEST_SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const run = randomBytes(4).toString('hex');
const createdIds: string[] = [];

interface Person {
  id: string;
  db: SupabaseClient;
}

async function person(name: string): Promise<Person> {
  const email = `${name}.${run}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdIds.push(data.user.id);
  const db = createClient(url, publishable, opts);
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const id = data.user.id;
  await db.from('profiles').insert({
    id,
    wrapped_private_key: `sealed-${name}`,
    wrap_salt: 'salt',
    recovery_wrapped_private_key: `recovery-${name}`,
    recovery_salt: 'salt',
    sealed_settings: `settings-${name}`
  });
  await db.from('public_keys').insert({ user_id: id, public_key: `pk-${name}` });
  return { id, db };
}

async function invite(from: Person, kind: 'account' | 'guest', inviterRole: 'top' | 'bottom' = 'top') {
  const { data, error } = await from.db
    .from('invites')
    .insert({ created_by: from.id, kind, inviter_role: inviterRole })
    .select('id, code')
    .single();
  if (error) throw error;
  return data as { id: string; code: string };
}

const anon = createClient(url, publishable, opts);
let river: Person; // a Top
let jade: Person; // a bottom, connected to River
let sol: Person; // a stranger to both

beforeAll(async () => {
  [river, jade, sol] = await Promise.all([person('river'), person('jade'), person('sol')]);
  const inv = await invite(river, 'account', 'top');
  const { error } = await jade.db.rpc('accept_invite', { invite_code: inv.code });
  if (error) throw error;
}, 60_000);

afterAll(async () => {
  await Promise.all(createdIds.map((id) => admin.auth.admin.deleteUser(id)));
}, 60_000);

describe('profiles', () => {
  it('lets you read your own', async () => {
    const { data } = await river.db.from('profiles').select('id');
    expect(data).toEqual([{ id: river.id }]);
  });

  it("never shows anyone else's, even a connection's", async () => {
    const { data } = await jade.db.from('profiles').select('id').eq('id', river.id);
    expect(data).toEqual([]);
  });

  it("refuses to create or change someone else's", async () => {
    const insert = await sol.db.from('profiles').insert({
      id: jade.id,
      wrapped_private_key: 'x',
      wrap_salt: 'x',
      recovery_wrapped_private_key: 'x',
      recovery_salt: 'x'
    });
    expect(insert.error).not.toBeNull();
    const { data } = await sol.db.from('profiles').update({ sealed_settings: 'hijacked' }).eq('id', jade.id).select();
    expect(data).toEqual([]);
  });

  it('shows nothing to someone signed out', async () => {
    const { data } = await anon.from('profiles').select('id');
    expect(data ?? []).toEqual([]);
  });
});

describe('public keys', () => {
  it('are visible to connections', async () => {
    const { data } = await jade.db.from('public_keys').select('public_key').eq('user_id', river.id);
    expect(data).toEqual([{ public_key: 'pk-river' }]);
  });

  it('are hidden from strangers', async () => {
    const { data } = await sol.db.from('public_keys').select('public_key').eq('user_id', river.id);
    expect(data).toEqual([]);
  });
});

describe('connections', () => {
  it('are visible to both people in them, with the right roles', async () => {
    const { data } = await jade.db.from('connections').select('top_id, bottom_id');
    expect(data).toEqual([{ top_id: river.id, bottom_id: jade.id }]);
  });

  it('are invisible to everyone else', async () => {
    const { data } = await sol.db.from('connections').select('id');
    expect(data).toEqual([]);
  });

  it('cannot be created directly, only by accepting an invite', async () => {
    const { error } = await sol.db.from('connections').insert({ top_id: sol.id, bottom_id: jade.id });
    expect(error).not.toBeNull();
  });
});

describe('invites', () => {
  it("can't be listed by anyone but their creator", async () => {
    await invite(river, 'account');
    const { data } = await sol.db.from('invites').select('id').eq('created_by', river.id);
    expect(data).toEqual([]);
  });

  it('can be looked up by code, showing only what the invitee needs', async () => {
    const inv = await invite(river, 'account');
    const { data } = await anon.rpc('get_invite', { invite_code: inv.code });
    expect(data).toEqual([
      {
        kind: 'account',
        inviter_role: 'top',
        suggested_path: null,
        sealed_note: null,
        inviter_public_key: 'pk-river',
        expired: false,
        used: false
      }
    ]);
  });

  it('get a server-made code that the client cannot choose', async () => {
    const { data } = await river.db
      .from('invites')
      .insert({ created_by: river.id, kind: 'account', inviter_role: 'top', code: 'CHOSEN99' })
      .select('code')
      .single();
    expect(data?.code).not.toBe('CHOSEN99');
    expect(data?.code).toHaveLength(8);
  });

  it('work once', async () => {
    const inv = await invite(river, 'account');
    expect((await sol.db.rpc('accept_invite', { invite_code: inv.code })).error).toBeNull();
    const again = await jade.db.rpc('accept_invite', { invite_code: inv.code });
    expect(again.error?.message).toMatch(/already been used/);
  });

  it('cannot be accepted by the person who made them', async () => {
    const inv = await invite(river, 'account');
    const { error } = await river.db.rpc('accept_invite', { invite_code: inv.code });
    expect(error?.message).toMatch(/your own invite/);
  });

  it('cannot be created for someone else', async () => {
    const { error } = await sol.db.from('invites').insert({ created_by: river.id, kind: 'account', inviter_role: 'top' });
    expect(error).not.toBeNull();
  });

  it('cannot last longer than 30 days', async () => {
    const far = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
    const { error } = await river.db
      .from('invites')
      .insert({ created_by: river.id, kind: 'account', inviter_role: 'top', expires_at: far, created_at: far });
    expect(error).not.toBeNull();
  });
});

describe('guest links', () => {
  it('accept one sealed submission without an account, readable only by the inviter', async () => {
    const inv = await invite(river, 'guest');
    expect(inv.code).toHaveLength(24);

    expect((await anon.rpc('submit_guest', { invite_code: inv.code, payload: 'sealed-answers' })).error).toBeNull();
    const again = await anon.rpc('submit_guest', { invite_code: inv.code, payload: 'second try' });
    expect(again.error?.message).toMatch(/already been used/);

    const mine = await river.db.from('guest_submissions').select('sealed_payload').eq('invite_id', inv.id);
    expect(mine.data).toEqual([{ sealed_payload: 'sealed-answers' }]);

    expect((await sol.db.from('guest_submissions').select('id')).data).toEqual([]);
    expect((await jade.db.from('guest_submissions').select('id')).data).toEqual([]);
    expect((await anon.from('guest_submissions').select('id')).data ?? []).toEqual([]);
  });

  it('cannot be used as an account invite', async () => {
    const inv = await invite(river, 'guest');
    const { error } = await sol.db.rpc('accept_invite', { invite_code: inv.code });
    expect(error?.message).toMatch(/not found/);
  });
});

describe('intakes', () => {
  it('number each new version for the owner', async () => {
    const one = await jade.db.from('intakes').insert({ owner_id: jade.id, sealed_intake: 'v1' }).select('version').single();
    const two = await jade.db.from('intakes').insert({ owner_id: jade.id, sealed_intake: 'v2' }).select('version').single();
    expect(two.data!.version).toBe(one.data!.version + 1);
  });

  it('stay private until the owner shares, even with a connection', async () => {
    const { data } = await river.db.from('intakes').select('id').eq('owner_id', jade.id);
    expect(data).toEqual([]);
  });

  it('can be read by a connection after sharing, and access ends when revoked', async () => {
    const grant = await jade.db
      .from('profile_shares')
      .insert({ owner_id: jade.id, recipient_id: river.id, wrapped_profile_key: 'key-for-river' });
    expect(grant.error).toBeNull();
    const shared = await river.db.from('intakes').select('sealed_intake').eq('owner_id', jade.id);
    expect(shared.data!.length).toBeGreaterThan(0);

    await jade.db.from('profile_shares').delete().eq('recipient_id', river.id);
    const revoked = await river.db.from('intakes').select('id').eq('owner_id', jade.id);
    expect(revoked.data).toEqual([]);
  });

  it('can only be shared with a connection', async () => {
    const { error } = await jade.db
      .from('profile_shares')
      .insert({ owner_id: jade.id, recipient_id: sol.id, wrapped_profile_key: 'x' });
    expect(error).not.toBeNull();
  });

  it("can't be written or deleted by anyone but the owner", async () => {
    const { error } = await river.db.from('intakes').insert({ owner_id: jade.id, sealed_intake: 'forged' });
    expect(error).not.toBeNull();
    const del = await river.db.from('intakes').delete().eq('owner_id', jade.id).select();
    expect(del.data).toEqual([]);
  });
});

describe('connection keys', () => {
  it('each member reads only their own copy', async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('bottom_id', jade.id).single();
    await river.db.from('connection_keys').insert([
      { connection_id: conn!.id, user_id: river.id, wrapped_key: 'for-river' },
      { connection_id: conn!.id, user_id: jade.id, wrapped_key: 'for-jade' }
    ]);
    const mine = await jade.db.from('connection_keys').select('wrapped_key');
    expect(mine.data).toEqual([{ wrapped_key: 'for-jade' }]);
    expect((await sol.db.from('connection_keys').select('wrapped_key')).data).toEqual([]);
  });

  it("can't be added to a connection you're not in", async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('bottom_id', jade.id).single();
    const { error } = await sol.db.from('connection_keys').insert({ connection_id: conn!.id, user_id: sol.id, wrapped_key: 'x' });
    expect(error).not.toBeNull();
  });
});
