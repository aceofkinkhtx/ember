import { useState } from 'react';
import { cashAppUrl, donation, donationAmounts, venmoUrl } from '../content/support';

/** Amount chips plus Cash App, Venmo and Zelle. Shared by Me and the monthly prompt. */
export function DonateOptions({ onDonated }: { onDonated?: () => void }) {
  const [amount, setAmount] = useState(donationAmounts[0]);
  const [copied, setCopied] = useState(false);

  return (
    <div className="stack">
      <div className="chips" role="radiogroup" aria-label="Amount">
        {donationAmounts.map((a) => (
          <button key={a} type="button" role="radio" className="chip" aria-checked={amount === a} onClick={() => setAmount(a)}>
            ${a}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a className="btn btn-secondary" href={cashAppUrl(amount)} target="_blank" rel="noreferrer" onClick={onDonated}>
          Cash App
        </a>
        <a className="btn btn-secondary" href={venmoUrl(amount)} target="_blank" rel="noreferrer" onClick={onDonated}>
          Venmo
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            navigator.clipboard?.writeText(donation.zelle.handle).then(
              () => setCopied(true),
              () => setCopied(false)
            );
            onDonated?.();
          }}
        >
          Zelle
        </button>
      </div>
      <p className="note" aria-live="polite">
        {copied
          ? `Copied ${donation.zelle.handle}. Paste it into Zelle in your bank app and send $${amount}.`
          : `Zelle: ${donation.zelle.handle}. Tip: Venmo payments can be public, so set yours to private.`}
      </p>
    </div>
  );
}
