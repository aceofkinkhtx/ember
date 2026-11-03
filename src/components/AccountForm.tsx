import { useState, type FormEvent } from 'react';
import { emptyIdentity } from '../content/identity';
import { AccountError, MIN_PASSWORD, signIn, signUp } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { RecoveryCode } from './RecoveryCode';

/** Create an account or sign in. Shown wherever an account is needed. */
export function AccountForm({ intro }: { intro?: string }) {
  const { update } = useSettings();
  const { refresh } = useAccount();
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  if (recoveryCode) {
    return <RecoveryCode code={recoveryCode} onDone={() => void refresh()} />;
  }

  const creating = mode === 'create';
  const problem = !/^\S+@\S+\.\S+$/.test(email.trim())
    ? 'Enter your email address.'
    : password.length < MIN_PASSWORD
      ? `Your password needs at least ${MIN_PASSWORD} characters.`
      : creating && confirm !== password
        ? "The two passwords don't match yet."
        : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = creating ? await signUp(email, password) : await signIn(email, password);
      if (result.kind === 'confirm-email') {
        setCheckEmail(true);
        setMode('signin');
      } else if (result.kind === 'new') {
        setRecoveryCode(result.recoveryCode);
      } else {
        // A new phone: bring back "About you" if this phone has none yet.
        const saved = result.saved?.identity;
        if (saved) update((s) => (s.identity.name ? {} : { identity: { ...emptyIdentity, ...saved } }));
        await refresh();
      }
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" style={{ gap: 16 }} onSubmit={submit} noValidate>
      {intro && <p>{intro}</p>}
      <div className="segmented" role="radiogroup" aria-label="Account" style={{ alignSelf: 'flex-start' }}>
        <button type="button" role="radio" aria-checked={creating} onClick={() => setMode('create')}>
          Create account
        </button>
        <button type="button" role="radio" aria-checked={!creating} onClick={() => setMode('signin')}>
          Sign in
        </button>
      </div>

      {checkEmail && (
        <p className="card card-teal" role="status">
          Check your email and tap the link to confirm. Then come back here and sign in with the same password.
        </p>
      )}

      <label className="field">
        <span className="field-label">Email</span>
        <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Password</span>
        {creating && (
          <span className="field-hint">
            At least {MIN_PASSWORD} characters. Your password unlocks your private data, so Ember never sees it.
          </span>
        )}
        <input
          className="input"
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {creating && (
        <label className="field">
          <span className="field-label">Password again</span>
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      )}

      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={Boolean(problem) || busy}>
        {busy ? 'Unlocking your keys...' : creating ? 'Create account' : 'Sign in'}
      </button>
      {problem && (email || password) && <p className="note">{problem}</p>}
      {!creating && (
        <p className="note">
          Forgot your password? Password reset with your recovery code arrives once Ember's email is connected.
        </p>
      )}
    </form>
  );
}
