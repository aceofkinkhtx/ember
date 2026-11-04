import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import { adaptScene } from '../../lib/scene/adapt';
import { acceptSceneRequest, declineSceneRequest, listIncomingRequests, type IncomingRequest } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { loadSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
import { displayName } from '../../screens/Connections';
import { Avatar } from '../Avatar';
import { MiniCurve, sceneFacts } from './SceneCurve';

// Designs a connection made for you. Accepting saves your own copy with your
// offerings and settings applied (anything that doesn't fit is taken out and
// listed); passing tells them quietly, so they can change it and send again.

export function SceneRequests() {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<{ request: IncomingRequest; from: Connection }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!keys) return;
    Promise.all([listIncomingRequests(keys), listConnections(keys, cardFor(settings.identity))])
      .then(([incoming, people]) =>
        setRequests(
          incoming.flatMap((request) => {
            const from = people.find((c) => c.otherId === request.fromId && c.status !== 'ended');
            return from ? [{ request, from }] : [];
          })
        )
      )
      .catch(() => setRequests([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  async function accept(request: IncomingRequest, from: Connection) {
    if (!keys) return;
    setBusy(request.id);
    setError('');
    try {
      const role = request.scene.role === 'bottom' ? 'top' : 'bottom';
      const data = await loadSceneData(keys, settings, from.id, from.otherId, role);
      const { scene, changes } = adaptScene(
        request.scene,
        data.ctx,
        { connectionId: from.id, partnerId: from.otherId, partnerName: displayName(from), role, intakeVersion: data.intakeVersion },
        {
          fromRequest: { by: displayName(from), at: request.sentAt },
          // A default title names the partner, so it should name them from this side.
          title: request.scene.title.startsWith('Scene with ') ? `Scene with ${displayName(from)}` : request.scene.title
        }
      );
      const saved = await acceptSceneRequest(keys, request, scene);
      navigate(`/scenes/${saved.id}`, { state: { changes } });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't accept that. Please try again.");
      setBusy(null);
    }
  }

  async function pass(request: IncomingRequest) {
    setBusy(request.id);
    setError('');
    try {
      await declineSceneRequest(request.id);
      setRequests((r) => r.filter((x) => x.request.id !== request.id));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!requests.length && !error) return null;
  return (
    <section className="stack" style={{ gap: 10 }} aria-label="Requests">
      <div className="eyebrow">Designed for you</div>
      {requests.map(({ request, from }) => (
        <article key={request.id} className="card stack" style={{ gap: 8 }} aria-label={request.scene.title}>
          <div className="person">
            <Avatar ownerId={from.otherId} photo={from.them?.photo} name={displayName(from)} size={36} />
            <span className="person-name" style={{ flex: 1 }}>
              {request.scene.title}
            </span>
            <span className="note">from {displayName(from)}</span>
          </div>
          <MiniCurve scene={request.scene} height={44} />
          <span className="note">
            {sceneFacts(request.scene)}
            {request.scene.date ? `, for ${new Date(`${request.scene.date}T12:00`).toLocaleDateString()}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void accept(request, from)}>
              Accept and edit
            </button>
            <button type="button" className="btn btn-quiet" disabled={busy !== null} onClick={() => void pass(request)}>
              Pass
            </button>
          </div>
        </article>
      ))}
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
