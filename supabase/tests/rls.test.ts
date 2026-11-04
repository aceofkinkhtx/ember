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

async function invite(from: Person, kind: 'account' | 'guest', inviterRole: 'top' | 'bottom' | 'switch' = 'top') {
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
    const { data } = await jade.db.from('connections').select('user_a, user_b');
    expect(data).toEqual([{ user_a: river.id, user_b: jade.id }]);
    const roles = await jade.db.from('connections').select('role_a, role_b');
    expect(roles.data).toEqual([{ role_a: 'top', role_b: 'bottom' }]);
  });

  it('are invisible to everyone else', async () => {
    const { data } = await sol.db.from('connections').select('id');
    expect(data).toEqual([]);
  });

  it('cannot be created directly, only by accepting an invite', async () => {
    const { error } = await sol.db.from('connections').insert({ user_a: sol.id, user_b: jade.id });
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
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    await river.db.from('connection_keys').insert([
      { connection_id: conn!.id, user_id: river.id, wrapped_key: 'for-river' },
      { connection_id: conn!.id, user_id: jade.id, wrapped_key: 'for-jade' }
    ]);
    const mine = await jade.db.from('connection_keys').select('wrapped_key');
    expect(mine.data).toEqual([{ wrapped_key: 'for-jade' }]);
    expect((await sol.db.from('connection_keys').select('wrapped_key')).data).toEqual([]);
  });

  it("can't be added to a connection you're not in", async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    const { error } = await sol.db.from('connection_keys').insert({ connection_id: conn!.id, user_id: sol.id, wrapped_key: 'x' });
    expect(error).not.toBeNull();
  });
});

describe('ending a connection', () => {
  it('is final for both, withdraws shared profiles, and only a new invite reconnects', async () => {
    const ash = await person('ash');
    const kit = await person('kit');
    const first = await invite(ash, 'account', 'top');
    expect((await kit.db.rpc('accept_invite', { invite_code: first.code })).error).toBeNull();
    const { data: conn } = await kit.db.from('connections').select('id').eq('user_a', ash.id).single();
    await kit.db.from('profile_shares').insert({ owner_id: kit.id, recipient_id: ash.id, wrapped_profile_key: 'k' });
    await kit.db.from('intakes').insert({ owner_id: kit.id, sealed_intake: 'kit-v1' });
    expect((await ash.db.from('intakes').select('id').eq('owner_id', kit.id)).data!.length).toBe(1);

    expect((await kit.db.from('connections').update({ status: 'ended' }).eq('id', conn!.id)).error).toBeNull();
    expect((await ash.db.from('intakes').select('id').eq('owner_id', kit.id)).data).toEqual([]);
    expect((await kit.db.from('profile_shares').select('recipient_id')).data).toEqual([]);
    expect((await ash.db.from('public_keys').select('public_key').eq('user_id', kit.id)).data).toEqual([]);

    const reopen = await ash.db.from('connections').update({ status: 'active' }).eq('id', conn!.id);
    expect(reopen.error?.message).toMatch(/has ended/);

    const again = await invite(ash, 'account', 'top');
    expect((await kit.db.rpc('accept_invite', { invite_code: again.code })).data).toBe(conn!.id);
    expect((await kit.db.from('connections').select('status').eq('id', conn!.id).single()).data!.status).toBe('active');
  });
});

describe('pausing a connection', () => {
  it('can only be undone by the person who paused', async () => {
    const lee = await person('lee');
    const max = await person('max');
    const inv = await invite(lee, 'account', 'top');
    await max.db.rpc('accept_invite', { invite_code: inv.code });
    const { data: conn } = await max.db.from('connections').select('id').eq('user_a', lee.id).single();

    expect((await max.db.from('connections').update({ status: 'paused' }).eq('id', conn!.id)).error).toBeNull();
    const byLee = await lee.db.from('connections').update({ status: 'active' }).eq('id', conn!.id);
    expect(byLee.error?.message).toMatch(/Only the person who paused/);
    expect((await lee.db.from('connections').select('paused_by').eq('id', conn!.id).single()).data!.paused_by).toBe(max.id);

    expect((await max.db.from('connections').update({ status: 'active' }).eq('id', conn!.id)).error).toBeNull();
    expect((await max.db.from('connections').select('status, paused_by').eq('id', conn!.id).single()).data).toEqual({ status: 'active', paused_by: null });
  });

  it("can't be faked by setting who paused", async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    const { error } = await river.db.from('connections').update({ paused_by: jade.id }).eq('id', conn!.id);
    expect(error).not.toBeNull();
  });
});

describe('connection cards', () => {
  it('are shared between the two people and hidden from everyone else', async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    expect((await jade.db.from('connection_cards').insert({ connection_id: conn!.id, user_id: jade.id, sealed_card: 'card-jade' })).error).toBeNull();
    const seen = await river.db.from('connection_cards').select('sealed_card').eq('user_id', jade.id);
    expect(seen.data).toEqual([{ sealed_card: 'card-jade' }]);
    expect((await sol.db.from('connection_cards').select('sealed_card')).data).toEqual([]);
    expect((await anon.from('connection_cards').select('sealed_card')).data ?? []).toEqual([]);
  });

  it("can't be written for the other person or for a connection you're not in", async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    expect((await river.db.from('connection_cards').insert({ connection_id: conn!.id, user_id: jade.id, sealed_card: 'forged' })).error).not.toBeNull();
    const changed = await river.db.from('connection_cards').update({ sealed_card: 'forged' }).eq('user_id', jade.id).select();
    expect(changed.data).toEqual([]);
    expect((await sol.db.from('connection_cards').insert({ connection_id: conn!.id, user_id: sol.id, sealed_card: 'x' })).error).not.toBeNull();
  });
});

describe('roles in a connection', () => {
  it('each person changes only their own, and the pair has to fit', async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    const theirs = await river.db.from('connections').update({ role_b: 'switch' }).eq('id', conn!.id);
    expect(theirs.error?.message).toMatch(/only change your own role/);

    expect((await jade.db.from('connections').update({ role_b: 'switch' }).eq('id', conn!.id)).error).toBeNull();
    expect((await river.db.from('connections').update({ role_a: 'switch' }).eq('id', conn!.id)).error).toBeNull();
    const bothSwitch = await jade.db.from('connections').select('role_a, role_b').eq('id', conn!.id).single();
    expect(bothSwitch.data).toEqual({ role_a: 'switch', role_b: 'switch' });

    expect((await river.db.from('connections').update({ role_a: 'bottom' }).eq('id', conn!.id)).error).toBeNull();
    const clash = await jade.db.from('connections').update({ role_b: 'bottom' }).eq('id', conn!.id);
    expect(clash.error).not.toBeNull();

    // Back to how the other tests expect it.
    await jade.db.from('connections').update({ role_b: 'bottom' }).eq('id', conn!.id);
    await river.db.from('connections').update({ role_a: 'top' }).eq('id', conn!.id);
  });

  it("can't move the people in a connection", async () => {
    const { data: conn } = await river.db.from('connections').select('id').eq('user_b', jade.id).single();
    const { error } = await river.db.from('connections').update({ user_b: sol.id }).eq('id', conn!.id);
    expect(error).not.toBeNull();
  });

  it('lets a switch invite and the invitee choose their role', async () => {
    const pat = await person('pat');
    const rae = await person('rae');
    const inv = await invite(pat, 'account', 'switch');
    expect((await rae.db.rpc('accept_invite', { invite_code: inv.code, my_role: 'switch' })).error).toBeNull();
    const { data } = await rae.db.from('connections').select('role_a, role_b').eq('user_a', pat.id).single();
    expect(data).toEqual({ role_a: 'switch', role_b: 'switch' });

    const bad = await invite(pat, 'account', 'top');
    const two = await person('two');
    const clash = await two.db.rpc('accept_invite', { invite_code: bad.code, my_role: 'top' });
    expect(clash.error?.message).toMatch(/fit together/);
  });
});

describe('personal codes and requests', () => {
  let owner: Person;
  let asker: Person;
  const code = ('ACE' + run).toUpperCase().slice(0, 12);

  beforeAll(async () => {
    owner = await person('owner');
    asker = await person('asker');
  }, 60_000);

  it('are chosen by their owner, unique, and show only scene name and role', async () => {
    const made = await owner.db
      .from('personal_codes')
      .insert({ user_id: owner.id, code: code.toLowerCase(), scene_name: 'Ace', role: 'top' })
      .select('code')
      .single();
    expect(made.data?.code).toBe(code);

    const taken = await asker.db.from('personal_codes').insert({ user_id: asker.id, code, scene_name: 'Copy', role: 'top' });
    expect(taken.error).not.toBeNull();
    const forSomeoneElse = await asker.db
      .from('personal_codes')
      .insert({ user_id: owner.id, code: ('OTHER' + run).toUpperCase(), scene_name: 'x', role: 'top' });
    expect(forSomeoneElse.error).not.toBeNull();

    const { data } = await anon.rpc('get_personal_code', { personal_code: code.toLowerCase() });
    expect(data).toEqual([{ scene_name: 'Ace', role: 'top', owner_public_key: 'pk-owner' }]);
    expect((await asker.db.from('personal_codes').select('code')).data).toEqual([]);
  });

  it('send a request that the owner accepts, with each person picking a role', async () => {
    expect((await asker.db.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'sealed-asker' })).error).toBeNull();
    const again = await asker.db.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'sealed-asker' });
    expect(again.error?.message).toMatch(/already waiting/);

    const mine = await owner.db.from('connection_requests').select('id, from_role, sealed_card, status');
    expect(mine.data).toHaveLength(1);
    expect(mine.data![0]).toMatchObject({ from_role: 'bottom', sealed_card: 'sealed-asker', status: 'pending' });
    expect((await sol.db.from('connection_requests').select('id')).data).toEqual([]);

    const stranger = await sol.db.rpc('respond_request', { request_id: mine.data![0].id, accept: true });
    expect(stranger.error).not.toBeNull();

    const accepted = await owner.db.rpc('respond_request', { request_id: mine.data![0].id, accept: true, my_role: 'switch' });
    expect(accepted.error).toBeNull();
    const conn = await asker.db.from('connections').select('user_a, user_b, role_a, role_b').eq('id', accepted.data).single();
    expect(conn.data).toEqual({ user_a: asker.id, user_b: owner.id, role_a: 'bottom', role_b: 'switch' });

    const connected = await asker.db.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'x' });
    expect(connected.error?.message).toMatch(/already connected/);
  });

  it('can be declined, and a block stays invisible to the person blocked', async () => {
    const pest = await person('pest');
    expect((await pest.db.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'sealed-pest' })).error).toBeNull();
    const req = (await owner.db.from('connection_requests').select('id').eq('from_id', pest.id).single()).data!;
    expect((await owner.db.rpc('respond_request', { request_id: req.id, accept: false, block: true })).error).toBeNull();
    expect((await pest.db.from('connection_requests').select('status')).data).toEqual([{ status: 'declined' }]);

    // Their next request looks sent to them, but the owner never sees it.
    await pest.db.from('connection_requests').delete().eq('from_id', pest.id);
    expect((await pest.db.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'again' })).error).toBeNull();
    expect((await pest.db.from('connection_requests').select('status')).data).toEqual([{ status: 'pending' }]);
    expect((await owner.db.from('connection_requests').select('id').eq('from_id', pest.id)).data).toEqual([]);
    expect((await pest.db.from('connection_requests').select('silenced')).error).not.toBeNull();
    expect((await pest.db.from('blocks').select('blocker_id')).data).toEqual([]);
  });

  it("stop working when turned off, and can't be used on yourself", async () => {
    const self = await owner.db.rpc('send_request', { personal_code: code, my_role: 'top', card: 'x' });
    expect(self.error?.message).toMatch(/your own code/);
    await owner.db.from('personal_codes').update({ active: false }).eq('user_id', owner.id);
    expect((await anon.rpc('get_personal_code', { personal_code: code })).data).toEqual([]);
    const off = await sol.db.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'x' });
    expect(off.error?.message).toMatch(/not found/);
  });

  it('need an account to send', async () => {
    const { error } = await anon.rpc('send_request', { personal_code: code, my_role: 'bottom', card: 'x' });
    expect(error).not.toBeNull();
  });
});

describe('toys', () => {
  let kit: Person; // keeps toys
  let moss: Person; // connected to Kit
  let fen: Person; // a stranger to Kit
  let connId: string;
  let toyId: string;

  beforeAll(async () => {
    [kit, moss, fen] = await Promise.all([person('toykeeper'), person('moss'), person('wren')]);
    const inv = await invite(kit, 'account', 'top');
    const accepted = await moss.db.rpc('accept_invite', { invite_code: inv.code });
    if (accepted.error) throw accepted.error;
    connId = accepted.data as string;
    const toy = await kit.db.from('toys').insert({ sealed_toy: 'locked-flogger' }).select('id, owner_id').single();
    if (toy.error) throw toy.error;
    expect(toy.data.owner_id).toBe(kit.id);
    toyId = toy.data.id;
  }, 60_000);

  // The file cache keeps a copy per sign-in, so Ember asks with a fresh value
  // each time; access is then checked on every request.
  async function photoSize(who: Person | null, path: string): Promise<number | null> {
    const { data } = await (who ? who.db : anon).storage.from('toy-photos').download(path, { cacheNonce: randomBytes(8).toString('hex') });
    return data ? data.size : null;
  }

  const photo = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' });

  it('are private to their owner until shared', async () => {
    expect((await kit.db.from('toys').select('sealed_toy')).data).toEqual([{ sealed_toy: 'locked-flogger' }]);
    expect((await moss.db.from('toys').select('id').eq('owner_id', kit.id)).data).toEqual([]);
    expect((await fen.db.from('toys').select('id').eq('owner_id', kit.id)).data).toEqual([]);
    expect((await anon.from('toys').select('id')).data ?? []).toEqual([]);
  });

  it("can't be made, changed or deleted for someone else", async () => {
    expect((await fen.db.from('toys').insert({ owner_id: kit.id, sealed_toy: 'x' })).error).not.toBeNull();
    expect((await moss.db.from('toys').update({ sealed_toy: 'changed' }).eq('id', toyId).select()).data).toEqual([]);
    await moss.db.from('toys').delete().eq('id', toyId);
    expect((await kit.db.from('toys').select('id').eq('id', toyId)).data).toHaveLength(1);
    const moved = await kit.db.from('toys').update({ owner_id: fen.id }).eq('id', toyId).select();
    expect(moved.error).not.toBeNull();
  });

  it('keep photos private, in the owner’s own folder only', async () => {
    const up = await kit.db.storage.from('toy-photos').upload(`${kit.id}/${toyId}`, photo(), { upsert: true, contentType: 'application/octet-stream', cacheControl: '0' });
    expect(up.error).toBeNull();
    const intoKits = await fen.db.storage.from('toy-photos').upload(`${kit.id}/planted`, photo(), { contentType: 'application/octet-stream', cacheControl: '0' });
    expect(intoKits.error).not.toBeNull();
    expect(await photoSize(fen, `${kit.id}/${toyId}`)).toBeNull();
    expect(await photoSize(moss, `${kit.id}/${toyId}`)).toBeNull();
    expect(await photoSize(null, `${kit.id}/${toyId}`)).toBeNull();
    expect(await photoSize(kit, `${kit.id}/${toyId}`)).toBe(4);
  });

  it('can be shared only with a connection, who can then see them and their photos', async () => {
    expect((await kit.db.from('toy_shares').insert({ owner_id: kit.id, recipient_id: fen.id, wrapped_toy_key: 'x' })).error).not.toBeNull();
    expect((await fen.db.from('toy_shares').insert({ owner_id: kit.id, recipient_id: fen.id, wrapped_toy_key: 'x' })).error).not.toBeNull();
    expect((await kit.db.from('toy_shares').insert({ owner_id: kit.id, recipient_id: moss.id, wrapped_toy_key: 'key-for-moss' })).error).toBeNull();

    expect((await moss.db.from('toys').select('sealed_toy').eq('owner_id', kit.id)).data).toEqual([{ sealed_toy: 'locked-flogger' }]);
    expect((await moss.db.from('toy_shares').select('wrapped_toy_key')).data).toEqual([{ wrapped_toy_key: 'key-for-moss' }]);
    expect(await photoSize(moss, `${kit.id}/${toyId}`)).toBe(4);
    expect((await fen.db.from('toys').select('id').eq('owner_id', kit.id)).data).toEqual([]);
    expect((await fen.db.from('toy_shares').select('owner_id')).data).toEqual([]);
    // Sharing reads, never writes.
    const overwrite = await moss.db.storage.from('toy-photos').upload(`${kit.id}/${toyId}`, photo(), { upsert: true, contentType: 'application/octet-stream', cacheControl: '0' });
    expect(overwrite.error).not.toBeNull();
    expect((await moss.db.from('toy_shares').delete().eq('owner_id', kit.id).select()).data).toEqual([]);
  });

  it('opt-outs are set only by the owner and seen only by the two people', async () => {
    expect((await moss.db.from('toy_opt_outs').insert({ connection_id: connId, toy_id: toyId })).error).not.toBeNull();
    expect((await fen.db.from('toy_opt_outs').insert({ connection_id: connId, toy_id: toyId })).error).not.toBeNull();
    expect((await kit.db.from('toy_opt_outs').insert({ connection_id: connId, toy_id: toyId })).error).toBeNull();
    expect((await moss.db.from('toy_opt_outs').select('toy_id')).data).toEqual([{ toy_id: toyId }]);
    expect((await fen.db.from('toy_opt_outs').select('toy_id')).data).toEqual([]);
    await moss.db.from('toy_opt_outs').delete().eq('toy_id', toyId);
    expect((await kit.db.from('toy_opt_outs').select('toy_id').eq('connection_id', connId)).data).toHaveLength(1);
  });

  it('stop being shared when the owner revokes or the connection ends', async () => {
    await kit.db.from('toy_shares').delete().eq('recipient_id', moss.id);
    expect((await moss.db.from('toys').select('id').eq('owner_id', kit.id)).data).toEqual([]);
    expect(await photoSize(moss, `${kit.id}/${toyId}`)).toBeNull();

    await kit.db.from('toy_shares').insert({ owner_id: kit.id, recipient_id: moss.id, wrapped_toy_key: 'again' });
    await moss.db.from('toy_shares').insert({ owner_id: moss.id, recipient_id: kit.id, wrapped_toy_key: 'mine' });
    expect((await moss.db.from('toys').select('id').eq('owner_id', kit.id)).data).toHaveLength(1);
    expect((await moss.db.from('connections').update({ status: 'ended' }).eq('id', connId)).error).toBeNull();
    expect((await moss.db.from('toys').select('id').eq('owner_id', kit.id)).data).toEqual([]);
    expect((await admin.from('toy_shares').select('owner_id').in('owner_id', [kit.id, moss.id])).data).toEqual([]);
  });

  it('go away with the toy, photo folder and all', async () => {
    expect((await kit.db.from('toys').delete().eq('id', toyId)).error).toBeNull();
    expect((await admin.from('toy_opt_outs').select('toy_id').eq('toy_id', toyId)).data).toEqual([]);
    expect((await kit.db.storage.from('toy-photos').remove([`${kit.id}/${toyId}`])).error).toBeNull();
    expect((await kit.db.storage.from('toy-photos').list(kit.id)).data).toEqual([]);
  });
});

describe('scenes', () => {
  let rook: Person; // designs scenes
  let sol: Person; // someone else
  let sceneId: string;

  beforeAll(async () => {
    [rook, sol] = await Promise.all([person('rook'), person('quill')]);
    const made = await rook.db.from('scenes').insert({ sealed_scene: 'locked-design' }).select('id, owner_id').single();
    if (made.error) throw made.error;
    expect(made.data.owner_id).toBe(rook.id);
    sceneId = made.data.id;
  }, 60_000);

  it('are read only by the person who made them', async () => {
    expect((await rook.db.from('scenes').select('sealed_scene')).data).toEqual([{ sealed_scene: 'locked-design' }]);
    expect((await sol.db.from('scenes').select('id')).data).toEqual([]);
    expect((await anon.from('scenes').select('id')).data ?? []).toEqual([]);
  });

  it("can't be made in someone else's name", async () => {
    expect((await sol.db.from('scenes').insert({ owner_id: rook.id, sealed_scene: 'forged' })).error).not.toBeNull();
    expect((await anon.from('scenes').insert({ sealed_scene: 'anon' })).error).not.toBeNull();
  });

  it('are changed and deleted only by their owner, and never handed to someone else', async () => {
    await sol.db.from('scenes').update({ sealed_scene: 'tampered' }).eq('id', sceneId);
    await sol.db.from('scenes').delete().eq('id', sceneId);
    expect((await admin.from('scenes').select('sealed_scene').eq('id', sceneId).single()).data?.sealed_scene).toBe('locked-design');
    expect((await rook.db.from('scenes').update({ owner_id: sol.id }).eq('id', sceneId)).error).not.toBeNull();
    expect((await rook.db.from('scenes').update({ sealed_scene: 'edited', updated_at: new Date().toISOString() }).eq('id', sceneId)).error).toBeNull();
    expect((await rook.db.from('scenes').delete().eq('id', sceneId)).error).toBeNull();
    expect((await admin.from('scenes').select('id').eq('id', sceneId)).data).toEqual([]);
  });
});

describe('scene requests', () => {
  let ash: Person; // a bottom who designs for their Top
  let birch: Person; // ash's Top
  let cedar: Person; // a stranger to both
  let connId: string;
  let requestId: string;

  beforeAll(async () => {
    [ash, birch, cedar] = await Promise.all([person('alder'), person('birch'), person('cedarwood')]);
    const inv = await invite(birch, 'account', 'top');
    const accepted = await ash.db.rpc('accept_invite', { invite_code: inv.code });
    if (accepted.error) throw accepted.error;
    connId = accepted.data as string;
  }, 60_000);

  it('can be sent only to a connection, in your own name', async () => {
    expect((await ash.db.from('scene_requests').insert({ to_id: cedar.id, sealed_scene: 'locked' })).error).not.toBeNull();
    expect((await cedar.db.from('scene_requests').insert({ from_id: ash.id, to_id: birch.id, sealed_scene: 'forged' })).error).not.toBeNull();
    expect((await anon.from('scene_requests').insert({ to_id: birch.id, sealed_scene: 'anon' })).error).not.toBeNull();
    expect((await ash.db.from('scene_requests').insert({ to_id: birch.id, sealed_scene: 'locked', status: 'accepted' })).error).not.toBeNull();
    const sent = await ash.db.from('scene_requests').insert({ to_id: birch.id, sealed_scene: 'locked-design' }).select('id, from_id, status').single();
    expect(sent.error).toBeNull();
    expect(sent.data).toMatchObject({ from_id: ash.id, status: 'sent' });
    requestId = sent.data!.id;
  });

  it('are seen only by the two people', async () => {
    expect((await birch.db.from('scene_requests').select('sealed_scene')).data).toEqual([{ sealed_scene: 'locked-design' }]);
    expect((await ash.db.from('scene_requests').select('id')).data).toHaveLength(1);
    expect((await cedar.db.from('scene_requests').select('id')).data).toEqual([]);
    expect((await anon.from('scene_requests').select('id')).data ?? []).toEqual([]);
  });

  it('are answered only by the recipient, who can change nothing else', async () => {
    await ash.db.from('scene_requests').update({ status: 'accepted' }).eq('id', requestId);
    await cedar.db.from('scene_requests').update({ status: 'declined' }).eq('id', requestId);
    expect((await admin.from('scene_requests').select('status').eq('id', requestId).single()).data?.status).toBe('sent');
    expect((await birch.db.from('scene_requests').update({ sealed_scene: 'swapped' }).eq('id', requestId)).error).not.toBeNull();
    expect((await birch.db.from('scene_requests').update({ status: 'sent' }).eq('id', requestId)).error).not.toBeNull();
    expect((await birch.db.from('scene_requests').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', requestId)).error).toBeNull();
    expect((await ash.db.from('scene_requests').select('status').eq('id', requestId).single()).data?.status).toBe('accepted');
  });

  it('are removed by either person, never a stranger, and go when the connection ends', async () => {
    await cedar.db.from('scene_requests').delete().eq('id', requestId);
    expect((await admin.from('scene_requests').select('id').eq('id', requestId)).data).toHaveLength(1);
    expect((await birch.db.from('scene_requests').delete().eq('id', requestId)).error).toBeNull();
    expect((await admin.from('scene_requests').select('id').eq('id', requestId)).data).toEqual([]);

    await ash.db.from('scene_requests').insert({ to_id: birch.id, sealed_scene: 'another' });
    await birch.db.from('scene_requests').insert({ to_id: ash.id, sealed_scene: 'one back' });
    expect((await ash.db.from('connections').update({ status: 'ended' }).eq('id', connId)).error).toBeNull();
    expect((await admin.from('scene_requests').select('id').in('from_id', [ash.id, birch.id])).data).toEqual([]);
  });
});
