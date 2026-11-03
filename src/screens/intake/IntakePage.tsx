import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountForm } from '../../components/AccountForm';
import { SharePanel } from '../../components/intake/SharePanel';
import { AccountError } from '../../lib/account';
import { clearDraft, emptyIntake, loadDraft, saveDraft, saveVersion, type Draft, type Intake, type Version } from '../../lib/intake';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { IntakeFlow } from './IntakeFlow';

// The member's intake: the flow, with the draft saved on this phone as it
// changes, then save as a numbered version and choose who sees it.

export function IntakePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(() => loadDraft() ?? { intake: emptyIntake(), basedOn: null });

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  return (
    <IntakeFlow
      value={draft.intake}
      onChange={(intake) => setDraft((d) => ({ ...d, intake }))}
      title={draft.basedOn ? `New intake, starting from #${draft.basedOn.version}` : 'New intake'}
      review={(intake) => <SaveAndShare draft={{ ...draft, intake }} onDone={() => navigate('/profile')} />}
    />
  );
}

function SaveAndShare({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const { settings } = useSettings();
  const account = useAccount();
  const [saved, setSaved] = useState<Version | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (account.status === 'signed-out') {
    return <AccountForm intro="Saving your intake needs an account, so it can be locked and shared only with the Tops you choose. Your answers are kept on this phone until then." />;
  }

  if (saved) {
    return (
      <section className="card stack" style={{ gap: 14 }}>
        <h2>Saved as intake #{saved.version}</h2>
        <p>Choose who can see it. You can change this anytime in your profile.</p>
        <SharePanel />
        <button type="button" className="btn btn-primary btn-block" onClick={onDone}>
          Done
        </button>
      </section>
    );
  }

  async function save(intake: Intake) {
    if (!account.keys) return;
    setBusy(true);
    setError('');
    try {
      const v = await saveVersion(account.keys, settings.identity, { ...draft, intake });
      clearDraft();
      setSaved(v);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't save your intake. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {error && <p className="note error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={busy || account.status !== 'signed-in'} onClick={() => save(draft.intake)}>
        {busy ? 'Locking and saving...' : 'Save this intake'}
      </button>
      <p className="note">It's locked on this phone first. Only the Tops you choose can open it.</p>
    </div>
  );
}
