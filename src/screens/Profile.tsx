import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IntakeSummary } from '../components/intake/IntakeSummary';
import { SharePanel } from '../components/intake/SharePanel';
import { tabLabel } from '../content/copy';
import { clearDraft, deleteVersion, emptyIntake, listVersions, loadDraft, saveDraft, type Version } from '../lib/intake';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

// BP1 and BP3: everything you've shared, every intake version, and who sees it.
// An intake can be filled for every scene, starting fresh or from an earlier one.

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function Profile() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { keys, status } = useAccount();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [draft, setDraftState] = useState(() => loadDraft());
  const [confirmDelete, setConfirmDelete] = useState<Version | null>(null);

  useEffect(() => {
    if (!keys) {
      setVersions([]);
      return;
    }
    listVersions(keys)
      .then(setVersions)
      .catch(() => setVersions([]));
  }, [keys]);

  function start(from: Version | null) {
    saveDraft(from ? { intake: from.intake, basedOn: { id: from.id, version: from.version } } : { intake: emptyIntake(), basedOn: null });
    navigate('/intake');
  }

  const latest = versions?.[0];

  return (
    <main className="screen">
      <h1>{tabLabel('profile', settings.discreet)}</h1>

      {draft && (
        <section className="card stack">
          <div className="eyebrow">In progress</div>
          <p>You have an intake you haven't saved yet{draft.basedOn ? `, starting from #${draft.basedOn.version}` : ''}.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/intake')}>
            Continue
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-block"
            onClick={() => {
              clearDraft();
              setDraftState(null);
            }}
          >
            Discard it
          </button>
        </section>
      )}

      {versions === null ? (
        <p className="note">Loading...</p>
      ) : !latest ? (
        !draft && (
          <section className="card stack">
            <p>
              Your intake tells a Top what you want, what's off limits and how you like to be cared for. Fill one for each
              scene, or reuse one you've saved. You choose who sees it.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => start(null)}>
              Start your intake
            </button>
          </section>
        )
      ) : (
        <>
          {!draft && (
            <section className="card stack">
              <p>Planning another scene? Start from your latest intake and change what's different, or start blank.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={() => start(latest)}>
                New intake from #{latest.version}
              </button>
              <button type="button" className="btn btn-quiet btn-block" onClick={() => start(null)}>
                Start blank
              </button>
            </section>
          )}

          <section className="stack" aria-labelledby="latest-title">
            <h2 id="latest-title" className="eyebrow">
              Latest: intake #{latest.version}, {dateFmt.format(new Date(latest.createdAt))}
            </h2>
            <IntakeSummary intake={latest.intake} />
          </section>

          {status === 'signed-in' && (
            <section className="card stack" aria-labelledby="sharing-title">
              <h2 id="sharing-title" className="eyebrow">
                Who sees your profile
              </h2>
              <SharePanel />
            </section>
          )}

          {versions.length > 1 && (
            <section className="stack" aria-labelledby="versions-title">
              <h2 id="versions-title" className="eyebrow">
                Earlier intakes
              </h2>
              <ul className="person-list">
                {versions.slice(1).map((v) => (
                  <li key={v.id} className="card person">
                    <div>
                      <div className="person-name">Intake #{v.version}</div>
                      <div className="note">{dateFmt.format(new Date(v.createdAt))}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" className="btn btn-quiet" onClick={() => start(v)}>
                        Reuse
                      </button>
                      <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(v)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {status === 'signed-in' && (
        <section className="card stack" aria-label="Your gear">
          <div className="eyebrow">{settings.discreet ? 'My items' : 'My gear'}</div>
          <p className="setting-desc" style={{ margin: 0 }}>
            Keep your own collection, with photos, and choose which connections can see it.
          </p>
          <Link to="/toys" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
            Open my gear
          </Link>
        </section>
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="sheet">
            <h2 id="delete-title">Delete intake #{confirmDelete.version}?</h2>
            <p>It's removed for you and anyone you shared it with. This can't be undone.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={async () => {
                await deleteVersion(confirmDelete.id).catch(() => undefined);
                setVersions((list) => (list ?? []).filter((x) => x.id !== confirmDelete.id));
                setConfirmDelete(null);
              }}
            >
              Delete
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
