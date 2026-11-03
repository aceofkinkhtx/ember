import { useEffect, useState } from 'react';
import { donationPromptDue, MIN_DONATION } from '../content/support';
import { useSettings } from '../state/settings';
import { DonateOptions } from './DonateOptions';

/** The once-a-month note about keeping Ember free. Appears on Home only. */
export function DonationPrompt() {
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(() =>
    donationPromptDue(new Date(), settings.safetyFloorAcknowledgedAt, settings.donationPromptedAt)
  );

  // Counting starts when the note appears, whatever the person chooses.
  useEffect(() => {
    if (open) update({ donationPromptedAt: new Date().toISOString() });
  }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="donate-title">
      <div className="sheet">
        <h2 id="donate-title">Help keep Ember free</h2>
        <p>
          Ember has no ads, no tracking and no subscriptions, and it stays free and open for everyone. If it has been
          useful to you, would you chip in? Gifts start at ${MIN_DONATION}.
        </p>
        <DonateOptions onDonated={() => setOpen(false)} />
        <button type="button" className="btn btn-quiet btn-block" onClick={() => setOpen(false)}>
          Not this month
        </button>
        <p className="note">We'll ask at most once a month.</p>
      </div>
    </div>
  );
}
