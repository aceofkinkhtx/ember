import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AccountForm } from '../components/AccountForm';
import { roleLabel } from '../content/copy';
import { AccountError, acceptInvite, cardFor, lookupInvite, type InviteInfo } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

// BO1: accept an invite, from a link or a typed code.

export function JoinInvite() {
  const { code = '' } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const account = useAccount();
  const [invite, setInvite] = useState<InviteInfo | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    lookupInvite(code, hash.slice(1) || undefined)
      .then(setInvite)
      .catch((err) => {
        setError(err instanceof AccountError ? err.message : "Ember couldn't look up that invite.");
        setInvite(null);
      });
  }, [code, hash]);

  const who = invite?.note?.name || 'Someone';
  const theirRole = invite ? roleLabel(invite.inviterRole, settings.discreet) : '';
  const yourRole = invite ? roleLabel(invite.inviterRole === 'top' ? 'bottom' : 'top', settings.discreet) : '';
  const problem =
    invite === null
      ? 'This invite was not found. Check the code and try again.'
      : invite?.kind === 'guest'
        ? 'This is a guest link. Open it in the browser instead.'
        : invite?.used
          ? 'This invite has already been used. Ask for a new one.'
          : invite?.expired
            ? 'This invite has expired. Ask for a new one.'
            : '';

  async function connect() {
    if (!account.keys) return;
    setBusy(true);
    setError('');
    try {
      await acceptInvite(account.keys, code, cardFor(settings.identity));
      navigate('/connections', { replace: true });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't connect you. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <h1>You're invited</h1>
      {invite === undefined && !error && <p className="note">Looking up your invite...</p>}
      {problem && <p className="card">{problem}</p>}

      {invite && !problem && (
        <>
          <section className="card stack">
            <p className="person-name">
              {who}
              {invite.note?.pronouns ? ` (${invite.note.pronouns})` : ''} wants to connect as your {theirRole}.
            </p>
            {invite.note?.message && <p>"{invite.note.message}"</p>}
            <p className="note">You'd be their {yourRole}. Roles belong to each connection, so this doesn't change how you play with anyone else.</p>
          </section>
          <section className="card stack">
            <p>
              Ember helps partners plan scenes together: what you want, what's off limits, and how you like to be cared for
              afterward. You decide what each person can see.
            </p>
            <p className="note">Your answers are locked on your phone before they leave it. Not even Ember can read them.</p>
          </section>

          {account.status === 'signed-out' ? (
            <AccountForm intro="To connect, create an account or sign in." />
          ) : (
            <button type="button" className="btn btn-primary btn-block" disabled={busy || account.status !== 'signed-in'} onClick={connect}>
              {busy ? 'Connecting...' : 'Connect'}
            </button>
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
