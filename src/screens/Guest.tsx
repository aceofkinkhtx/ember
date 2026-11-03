import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { EmberMark } from '../components/EmberMark';
import { IdentityForm } from '../components/IdentityForm';
import { emptyIdentity, pronounLabel, type Identity } from '../content/identity';
import { AccountError, lookupInvite, submitGuestAnswers, type InviteInfo } from '../lib/account';
import { emptyDetailed, emptyIntake, type Intake, type PathId } from '../lib/intake';
import { IntakeFlow } from './intake/IntakeFlow';

// G1 and G2: someone without an account fills the full intake in the browser.
// Answers stay in memory only (never saved in a browser that may be shared)
// and are locked for the inviter before they are sent.

export function Guest() {
  const { code = '' } = useParams();
  const { hash } = useLocation();
  const [invite, setInvite] = useState<InviteInfo | null | undefined>(undefined);
  const [step, setStep] = useState<'welcome' | 'answers' | 'intake' | 'done'>('welcome')
  const [intake, setIntake] = useState<Intake>(emptyIntake);
  const [identity, setIdentity] = useState<Identity>(emptyIdentity);
  const [message, setMessage] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    lookupInvite(code, hash.slice(1) || undefined)
      .then((found) => {
        setInvite(found);
        // Start on the way of answering the inviter suggested.
        const suggested: Record<string, PathId> = { words: 'quick', map: 'map', detailed: 'detailed' };
        const path = found?.suggestedPath ? suggested[found.suggestedPath] : undefined;
        if (path)
          setIntake((i) => ({
            ...i,
            paths: [path],
            quick: path === 'quick' ? { words: { heat: [], hold: [], flow: [] }, decoder: {} } : null,
            detailed: path === 'detailed' ? emptyDetailed() : null
          }));
      })
      .catch(() => setInvite(null));
  }, [code, hash]);

  const who = invite?.note?.name || 'The person who sent this link';
  const problem =
    invite === null || invite?.kind === 'account'
      ? "This link doesn't work. Ask for a new one."
      : invite?.used
        ? 'This link has already been used. If that was you, your answers were sent.'
        : invite?.expired
          ? 'This link has expired. Ask for a new one.'
          : '';

  async function send() {
    if (!invite) return;
    setBusy(true);
    setError('');
    try {
      await submitGuestAnswers(code, invite.inviterPublicKey, {
        name: identity.name.trim(),
        pronouns: pronounLabel(identity),
        message: message.trim(),
        adultConfirmedAt: new Date().toISOString(),
        intake
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Your answers weren't sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (invite && !problem && step === 'intake') {
    return (
      <div className="app" data-theme="rose">
        <IntakeFlow
          value={intake}
          onChange={setIntake}
          title={`For ${who}`}
          review={() => (
            <div className="stack">
              {error && <p className="note error" role="alert">{error}</p>}
              <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={send}>
                {busy ? 'Locking and sending...' : 'Send my answers'}
              </button>
              <p className="note">Locked in this browser so only {invite.note?.name || 'they'} can read it. Nothing is kept here after you leave.</p>
            </div>
          )}
        />
      </div>
    );
  }

  return (
    <div className="app" data-theme="rose">
      <main className="screen">
        <EmberMark />
        {invite === undefined && <p className="note">Opening your link...</p>}
        {problem && <p className="card">{problem}</p>}

        {invite && !problem && step === 'welcome' && (
          <>
            <h1>{who} invited you</h1>
            {invite.note?.message && <p className="card">"{invite.note.message}"</p>}
            <section className="card stack">
              <p>
                Ember helps partners plan scenes with care. {who} would like to know a little about you before you play.
              </p>
              <p>
                <strong>What they'll see:</strong> only what you enter here. <strong>What they won't:</strong> anything
                else about you, your browser, or where you are.
              </p>
              <p className="note">It takes 5 to 15 minutes, depending on how much you share. Your answers are locked in this browser before they're sent, so only {invite.note?.name || 'they'} can read them.</p>
            </section>
            <label className="check">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              I'm 18 or older
            </label>
            <button type="button" className="btn btn-primary btn-block" disabled={!adult} onClick={() => setStep('answers')}>
              Start
            </button>
            {!adult && <p className="note" style={{ textAlign: 'center' }}>Ember is only for adults 18 and over.</p>}
          </>
        )}

        {invite && !problem && step === 'answers' && (
          <>
            <h1>About you</h1>
            <IdentityForm value={identity} onChange={(change) => setIdentity((prev) => change(prev))} />
            <label className="field">
              <span className="field-label">Anything you'd like {invite.note?.name || 'them'} to know?</span>
              <span className="field-hint">Optional.</span>
              <textarea className="input" rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('intake')}>
              Continue
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <h1>Sent</h1>
            <section className="card stack">
              <p>{invite?.note?.name ? `${invite.note.name} has` : 'They have'} your answers now, locked so only they can read them.</p>
              <p>
                Want to keep and change your answers later, or get check-ins after a scene? Create a free Ember account. You
                can add it to your home screen from your browser's menu.
              </p>
            </section>
            <a className="btn btn-secondary btn-block" href="/">
              Get Ember
            </a>
          </>
        )}
      </main>
    </div>
  );
}
