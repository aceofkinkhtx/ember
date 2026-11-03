import { useState } from 'react';
import { formatRecoveryCode } from '../lib/crypto';

/** Shown once, right after the account is made. */
export function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const pretty = formatRecoveryCode(code);

  return (
    <section className="card stack" style={{ gap: 16 }} aria-labelledby="recovery-title">
      <h2 id="recovery-title">Your recovery code</h2>
      <p>
        This is the spare key to your private data. If you forget your password, this code is the only way to get your
        data back. Ember can't recover it for you, and you'll only see it this once.
      </p>
      <p
        aria-label="Recovery code"
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 20, letterSpacing: 1, textAlign: 'center', wordBreak: 'break-word', userSelect: 'all' }}
      >
        {pretty}
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => {
          void navigator.clipboard?.writeText(pretty).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? 'Copied' : 'Copy code'}
      </button>
      <p className="note">Save it in a password manager or write it down somewhere private. Don't send it to anyone.</p>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I saved my recovery code
      </label>
      <button type="button" className="btn btn-primary btn-block" disabled={!saved} onClick={onDone}>
        Continue
      </button>
    </section>
  );
}
