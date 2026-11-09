import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RecoveryCode } from '../components/RecoveryCode';
import { useRestoreSaved } from '../components/AccountForm';
import { AccountError, MIN_PASSWORD, resetLinkEmail, resetWithRecoveryCode } from '../lib/account';
import { normalizeRecoveryCode, RECOVERY_CODE_LENGTH } from '../lib/crypto';
import { useAccount } from '../state/account';

// Opened from the emailed reset link. The link proves the email; the recovery
// code unlocks the private data, which is then locked with the new password.

export function ResetPassword() {
  const navigate = useNavigate();
  const { refresh } = useAccount();
  const restore = useRestoreSaved();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    void resetLinkEmail()
      .catch(() => null)
      .then(setEmail);
  }, []);

  const done = async () => {
    await refresh();
    navigate('/', { replace: true });
  };

  if (newCode) {
    return (
      <main className="screen">
        <RecoveryCode code={newCode} onDone={() => void done()} />
      </main>
    );
  }

  const problem =
    normalizeRecoveryCode(code).length !== RECOVERY_CODE_LENGTH
      ? `Enter your recovery code: ${RECOVERY_CODE_LENGTH} letters and numbers.`
      : password.length < MIN_PASSWORD
        ? `Your new password needs at least ${MIN_PASSWORD} characters.`
        : confirm !== password
          ? "The two passwords don't match yet."
          : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await resetWithRecoveryCode(code, password);
      if (result.kind === 'new') setNewCode(result.recoveryCode);
      else {
        if (result.kind === 'ready') restore(result.saved);
        await done();
      }
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <h1>Reset your password</h1>
      {email === undefined ? (
        <p className="note" role="status">
          Opening your reset link...
        </p>
      ) : email === null ? (
        <section className="card stack" style={{ gap: 12 }}>
          <p style={{ margin: 0 }}>This reset link has expired or was already used. Ask for a new one: in Connections, choose Sign in, then Forgot your password?</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/connections', { replace: true })}>
            Go to Connections
          </button>
        </section>
      ) : (
        <form className="card stack" style={{ gap: 16 }} onSubmit={submit} noValidate>
          <p style={{ margin: 0 }}>
            Resetting the password for <strong>{email}</strong>. Your recovery code unlocks your private data, and your new password locks it again.
          </p>
          <label className="field">
            <span className="field-label">Recovery code</span>
            <span className="field-hint">The code you saved when you made your account. Dashes and spaces don't matter.</span>
            <input
              className="input"
              value={code}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <span className="field-hint">At least {MIN_PASSWORD} characters.</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">New password again</span>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error && (
            <p className="note error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={Boolean(problem) || busy}>
            {busy ? 'Unlocking your keys...' : 'Set my new password'}
          </button>
          {problem && (code || password) && <p className="note">{problem}</p>}
          <details>
            <summary className="note" style={{ cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }}>
              I don't have my recovery code
            </summary>
            <p className="note" style={{ margin: 0 }}>
              Without it, nobody can open your locked data, not even Ember. That's what keeps it private. If you remember your old password, sign in
              with it instead. If not, your account and what's in it can't be recovered.
            </p>
          </details>
        </form>
      )}
    </main>
  );
}
