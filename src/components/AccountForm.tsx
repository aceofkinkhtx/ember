import { useState, type FormEvent } from 'react';
import { emptyIdentity } from '../content/identity';
import { defaultTopSetupFrom } from '../content/topSetup';
import { AccountError, MIN_PASSWORD, sendPasswordReset, signIn, signUp, type SavedProfile } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { RecoveryCode } from './RecoveryCode';

const looksLikeEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim());

/** A new phone: brings back "About you" and a Top's setup, if this phone has none yet. */
export function useRestoreSaved() {
  const { update } = useSettings();
  return (saved: SavedProfile | null) => {
    const identity = saved?.identity;
    if (identity) update((s) => (s.identity.name ? {} : { identity: { ...emptyIdentity, ...identity } }));
    const top = saved?.top;
    if (top) update((s) => (s.top.offerings.setAt || s.top.settings.setAt ? {} : { top: defaultTopSetupFrom(top) }));
  };
}

/** Create an account or sign in. Shown wherever an account is needed. */
export function AccountForm({ intro }: { intro?: string }) {
  const { refresh } = useAccount();
  const restore = useRestoreSaved();
  const [mode, setMode] = useState<'create' | 'signin' | 'forgot'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  if (recoveryCode) {
    return <RecoveryCode code={recoveryCode} onDone={() => void refresh()} />;
  }

  if (mode === 'forgot') {
    const ready = looksLikeEmail(email);
    async function sendReset(e: FormEvent) {
      e.preventDefault();
      if (!ready || busy) return;
      setBusy(true);
      setError('');
      try {
        await sendPasswordReset(email);
        setResetSent(true);
      } catch (err) {
        setError(err instanceof AccountError ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(false);
      }
    }
    return (
      <form className="card stack" style={{ gap: 16 }} onSubmit={sendReset} noValidate>
        <h2 style={{ margin: 0 }}>Reset your password</h2>
        <p style={{ margin: 0 }}>
          You'll need two things: your email, for a reset link, and the recovery code you saved when you made your account. Your password locks
          your private data, so only your recovery code can unlock it again. Ember can't do it for you.
        </p>
        {resetSent ? (
          <p className="card card-teal" role="status" style={{ margin: 0 }}>
            If {email.trim()} has an Ember account, a reset link is on its way. Open it on this phone. If it isn't in your inbox within a few minutes,
            look in your spam or junk folder.
          </p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Email</span>
              <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && (
              <p className="note error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={!ready || busy}>
              {busy ? 'Sending...' : 'Email me a reset link'}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            setMode('signin');
            setResetSent(false);
            setError('');
          }}
        >
          Back to sign in
        </button>
      </form>
    );
  }

  const creating = mode === 'create';
  const problem = !looksLikeEmail(email)
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
        restore(result.saved);
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
          Check your email and tap the link to confirm. If it isn't in your inbox within a few minutes, look in your spam or junk folder. Then come back here and sign in with the same password.
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
        <button
          type="button"
          className="btn btn-quiet"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setMode('forgot');
            setError('');
          }}
        >
          Forgot your password?
        </button>
      )}
    </form>
  );
}
