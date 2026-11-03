import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AccountForm } from '../components/AccountForm';
import { RolePicker } from '../components/RolePicker';
import { roleLabel } from '../content/copy';
import {
  AccountError,
  acceptInvite,
  cardFor,
  complement,
  lookupInvite,
  lookupPersonalCode,
  rolesFit,
  sendRequest,
  type CodeOwner,
  type InviteInfo,
  type Role
} from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

// BO1: open a code or link. A one-time invite connects right away; a
// personal code sends a request its owner accepts or declines.

type Found = { kind: 'invite'; invite: InviteInfo } | { kind: 'code'; owner: CodeOwner } | null;

export function JoinInvite() {
  const { code = '' } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const account = useAccount();
  const [found, setFound] = useState<Found | undefined>(undefined);
  const [myRole, setMyRole] = useState<Role>('bottom');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const invite = await lookupInvite(code, hash.slice(1) || undefined);
      if (invite) {
        setMyRole(complement(invite.inviterRole));
        return setFound({ kind: 'invite', invite });
      }
      const owner = await lookupPersonalCode(code);
      if (owner) {
        setMyRole(complement(owner.role));
        return setFound({ kind: 'code', owner });
      }
      setFound(null);
    })().catch((err) => {
      setError(err instanceof AccountError ? err.message : "Ember couldn't look up that code.");
      setFound(null);
    });
  }, [code, hash]);

  const invite = found?.kind === 'invite' ? found.invite : null;
  const owner = found?.kind === 'code' ? found.owner : null;
  const who = invite ? invite.note?.name || 'Someone' : owner?.sceneName ?? '';
  const pronouns = invite?.note?.pronouns;
  const theirRole = invite?.inviterRole ?? owner?.role ?? 'top';
  const fits = rolesFit(theirRole, myRole);
  const problem =
    found === null
      ? 'That code was not found. Check it and try again.'
      : invite?.kind === 'guest'
        ? 'This is a guest link. Open it in the browser instead.'
        : invite?.used
          ? 'This invite has already been used. Ask for a new one.'
          : invite?.expired
            ? 'This invite has expired. Ask for a new one.'
            : '';

  async function go() {
    if (!account.keys || !found) return;
    setBusy(true);
    setError('');
    try {
      const me = cardFor(settings.identity);
      if (found.kind === 'invite') {
        await acceptInvite(account.keys, code, me, myRole);
        navigate('/connections', { replace: true });
        return;
      }
      await sendRequest(code, found.owner, myRole, me);
      setSent(true);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="screen">
        <h1>Request sent</h1>
        <section className="card stack">
          <p>
            {who} will see your scene name, pronouns and the role you chose, and can accept or decline. You'll find them in
            your Connections once they accept.
          </p>
        </section>
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/connections', { replace: true })}>
          Back to Connections
        </button>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1>{owner ? `Connect with ${who}` : "You're invited"}</h1>
      {found === undefined && !error && <p className="note">Looking up the code...</p>}
      {problem && <p className="card">{problem}</p>}

      {found && !problem && (
        <>
          <section className="card stack">
            <p className="person-name">
              {who}
              {pronouns ? ` (${pronouns})` : ''}
            </p>
            <p className="note">
              {roleLabel(theirRole, settings.discreet).replace(/^./, (x) => x.toUpperCase())}
            </p>
            {invite?.note?.message && <p>"{invite.note.message}"</p>}
          </section>

          <section className="card stack">
            <RolePicker label={`Your role with ${who}`} value={myRole} onChange={setMyRole} discreet={settings.discreet} />
            <p className="note">
              {fits
                ? 'Switch means either way: whoever designs a scene picks the role they design it as. You can change your role later.'
                : "Those roles don't fit together. One of you needs to Top or switch, and the other to bottom or switch."}
            </p>
          </section>

          <section className="card stack">
            <p>
              Ember helps partners plan scenes together: what you want, what's off limits, and how you like to be cared for
              afterward. You decide what each person can see.
            </p>
            <p className="note">Your answers are locked on your phone before they leave it. Not even Ember can read them.</p>
          </section>

          {account.status === 'signed-out' ? (
            <AccountForm intro={owner ? 'To send a request, create an account or sign in.' : 'To connect, create an account or sign in.'} />
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || !fits || account.status !== 'signed-in'}
              onClick={go}
            >
              {busy ? 'One moment...' : owner ? 'Send request' : 'Connect'}
            </button>
          )}
          {owner && account.status === 'signed-in' && (
            <p className="note">{who} sees your scene name, pronouns and role, and decides whether to accept.</p>
          )}
        </>
      )}

      {error && <p className="note error" role="alert">{error}</p>}
      <button type="button" className="btn btn-quiet btn-block" onClick={() => navigate('/connections')}>
        Not now
      </button>
    </main>
  );
}
