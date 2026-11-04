import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import { adaptScene } from '../../lib/scene/adapt';
import type { RequestStatus, Scene } from '../../lib/scene/model';
import { blocks, validate, type RuleContext } from '../../lib/scene/rules';
import { saveScene, sendSceneRequest, sentRequestStatuses, withdrawSceneRequest } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { loadSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
import { displayName } from '../../screens/Connections';

// Editor actions added in M4b: sending a design to your Top as a request, and
// reusing a design with someone else.

const statusText: Record<RequestStatus, (name: string) => string> = {
  sent: (name) => `Sent to ${name}. Waiting for them to accept it.`,
  accepted: (name) => `${name} accepted this design and is shaping it now.`,
  declined: (name) => `${name} passed on this one. You can change it and send it again.`
};

/** For a design made as the bottom: send it to the Top, see their answer. */
export function RequestCard({ scene, ctx, onChange }: { scene: Scene; ctx: RuleContext; onChange: (s: Scene) => void }) {
  const { keys } = useAccount();
  const [status, setStatus] = useState<RequestStatus | null>(scene.request?.status ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!keys || !scene.request) return;
    const id = scene.request.id;
    sentRequestStatuses(keys)
      .then((all) => setStatus(all[id] ?? null))
      .catch(() => undefined);
  }, [keys, scene.request]);

  const blocked = blocks(validate(scene, ctx));

  async function run(task: () => Promise<Scene>) {
    setBusy(true);
    setError('');
    try {
      const next = await task();
      onChange(next);
      setStatus(next.request?.status ?? null);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" style={{ gap: 10 }} aria-label={`Send to ${scene.partnerName}`}>
      <div className="eyebrow">A request for {scene.partnerName}</div>
      <p className="setting-desc" style={{ margin: 0 }}>
        {status
          ? statusText[status](scene.partnerName)
          : `Send this to ${scene.partnerName}. They get it as a request, then accept and shape it with their own offerings and settings, or pass.`}
      </p>
      {blocked.length > 0 && <p className="note" style={{ margin: 0 }}>Fix the red items above before sending.</p>}
      {(!status || status === 'declined' || status === 'sent') && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
          disabled={busy || blocked.length > 0 || !keys}
          onClick={() => void run(() => sendSceneRequest(keys!, scene))}
        >
          {status ? 'Send the latest version' : `Send to ${scene.partnerName}`}
        </button>
      )}
      {status === 'sent' && (
        <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void run(() => withdrawSceneRequest(keys!, scene))}>
          Take it back
        </button>
      )}
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Pick someone, adapt the design to them, save it as a new scene. */
export function ReuseSheet({ scene, onClose }: { scene: Scene; onClose: () => void }) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Connection[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!keys) return;
    listConnections(keys, cardFor(settings.identity))
      .then((all) => setPeople(all.filter((c) => c.status === 'active' && c.id !== scene.connectionId)))
      .catch(() => setPeople([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  async function reuse(c: Connection) {
    if (!keys) return;
    setBusy(true);
    setError('');
    try {
      const role = c.myRole === 'top' ? 'top' : c.myRole === 'bottom' ? 'bottom' : scene.role;
      const data = await loadSceneData(keys, settings, c.id, c.otherId, role);
      const { scene: next, changes } = adaptScene(scene, data.ctx, {
        connectionId: c.id,
        partnerId: c.otherId,
        partnerName: displayName(c),
        role,
        intakeVersion: data.intakeVersion
      }, { title: scene.title.replace(/ with .*$/, '') + ` with ${displayName(c)}`, date: '', startTime: '' });
      const saved = await saveScene(keys, next);
      navigate(`/scenes/${saved.id}`, { state: { changes } });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't copy this design. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="reuse-title" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 id="reuse-title" style={{ margin: 0 }}>
          Use with someone else
        </h2>
        <p style={{ margin: 0 }}>
          Ember makes a new copy for them and checks it against their limits and gear. Anything that doesn't fit is taken out and listed.
        </p>
        {people === null ? (
          <p className="note">Loading...</p>
        ) : people.length === 0 ? (
          <p className="note">No other connections yet.</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {people.map((c) => (
              <button key={c.id} type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => void reuse(c)}>
                {displayName(c)}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="note error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
