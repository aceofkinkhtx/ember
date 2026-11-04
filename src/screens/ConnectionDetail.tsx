import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RolePicker } from '../components/RolePicker';
import { IntakeSummary } from '../components/intake/IntakeSummary';
import { SharePanel } from '../components/intake/SharePanel';
import { ConnectionToys } from '../components/toys/ConnectionToys';
import { readSharedProfile, type SharedProfile } from '../lib/intake';
import { AccountError, cardFor, listConnections, rolesFit, setConnectionStatus, setMyRole, type Connection, type Role } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { connectionSummary, displayName } from './Connections';

// C3 (Top) and BC2 (bottom): one connection. Scenes, history and progress
// fill in here as later milestones land.

const comingSections = [
  { title: 'History', body: 'Debriefs, check-ins and what changed after each scene, so the next one starts smarter.' },
  { title: 'Progress', body: 'How your play has grown over time: new yeses, softened limits and favorite moments.' }
];

export function ConnectionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { keys, status } = useAccount();
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [theirProfile, setTheirProfile] = useState<SharedProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!keys || !connection) return;
    readSharedProfile(keys, connection.otherId)
      .then(setTheirProfile)
      .catch(() => setTheirProfile(null));
  }, [keys, connection?.otherId]);

  useEffect(() => {
    if (!keys) return;
    listConnections(keys, cardFor(settings.identity))
      .then((all) => setConnection(all.find((c) => c.id === id && c.status !== 'ended') ?? null))
      .catch(() => setConnection(null));
    // Loaded once per visit; the card text is refreshed by the account provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, id]);

  async function changeRole(role: Role) {
    if (!connection) return;
    setError('');
    if (!rolesFit(connection.theirRole, role)) {
      setError("Those roles don't fit together. One of you needs to Top or switch, and the other to bottom or switch.");
      return;
    }
    const before = connection;
    setConnection({ ...connection, myRole: role });
    try {
      await setMyRole(before, role);
    } catch (err) {
      setConnection(before);
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    }
  }

  async function change(next: Connection['status']) {
    if (!connection) return;
    setBusy(true);
    setError('');
    try {
      await setConnectionStatus(connection.id, next);
      if (next === 'ended') navigate('/connections', { replace: true });
      else setConnection({ ...connection, status: next, pausedByMe: next === 'paused' });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'That didn\'t work. Please try again.');
    } finally {
      setBusy(false);
      setConfirmEnd(false);
    }
  }

  if (status === 'signed-out' || connection === null) {
    return (
      <main className="screen">
        <Link to="/connections" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Back
        </Link>
        <p className="card">This connection isn't available.</p>
      </main>
    );
  }

  if (!connection) {
    return (
      <main className="screen">
        <p className="note">Loading...</p>
      </main>
    );
  }

  const name = displayName(connection);
  const paused = connection.status === 'paused';

  return (
    <main className="screen">
      <Link to="/connections" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Back
      </Link>
      <div>
        <h1>{name}</h1>
        <p className="note">{connectionSummary(connection, settings.discreet)}</p>
        {paused && <span className="chip">Paused</span>}
      </div>

      <section className="card stack" aria-label="Roles">
        <RolePicker label={`Your role with ${name}`} value={connection.myRole} onChange={changeRole} discreet={settings.discreet} />
        <p className="note">
          Each of you chooses your own role. With a switch, whoever designs a scene picks the role they design it as.
        </p>
      </section>

      {connection.theirRole !== 'top' && (
        <section className="stack" aria-labelledby="their-profile">
          <h2 id="their-profile" className="eyebrow">
            {name}'s profile
          </h2>
          {theirProfile === undefined ? (
            <p className="note">Loading...</p>
          ) : theirProfile ? (
            <>
              <p className="note">
                Intake #{theirProfile.version}
                {theirProfile.full ? '' : ', essentials only'}
              </p>
              <IntakeSummary intake={theirProfile.intake} full={theirProfile.full} />
            </>
          ) : (
            <p className="card">{name} hasn't shared a profile with you yet.</p>
          )}
        </section>
      )}

      {connection.myRole !== 'top' && (
        <section className="card stack" aria-label="Your sharing">
          <div className="eyebrow">Your profile</div>
          <SharePanel only={connection.otherId} />
        </section>
      )}

      {connection.status === 'active' && (
        <section className="card stack" aria-label="Scenes">
          <div className="eyebrow">Scenes</div>
          <p className="setting-desc" style={{ margin: 0 }}>
            {connection.myRole === 'bottom'
              ? `Design a scene for ${name} from what you said yes to. It arrives as a request they accept and shape.`
              : connection.myRole === 'switch'
                ? `Design a scene with ${name}, as the Top or as the bottom.`
                : `Design a scene from what ${name} said yes to and what you offer.`}
          </p>
          <Link to={`/scenes/new?connection=${connection.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            {connection.myRole === 'bottom' ? `Design a scene for ${name}` : 'New scene'}
          </Link>
        </section>
      )}
      <ConnectionToys connection={connection} name={name} />

      {comingSections.map((s) => (
        <section key={s.title} className="card">
          <div className="eyebrow">{s.title}</div>
          <p className="note">{s.body}</p>
        </section>
      ))}

      <section className="card stack" aria-label="Manage this connection">
        <div className="eyebrow">Manage</div>
        {paused && !connection.pausedByMe ? (
          <p className="note">{name} paused this connection. Only they can resume it.</p>
        ) : (
          <>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => change(paused ? 'active' : 'paused')}>
              {paused ? 'Resume connection' : 'Pause connection'}
            </button>
            <p className="note">
              {paused
                ? 'Only you can resume it.'
                : 'Pausing gives you space. Everything stays as it is, no new scenes can be planned, and only you can resume.'}
            </p>
          </>
        )}
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setConfirmEnd(true)}>
          End connection
        </button>
        {error && <p className="note error" role="alert">{error}</p>}
      </section>

      {confirmEnd && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className="sheet">
            <h2 id="end-title">End your connection with {name}?</h2>
            <p>
              This ends it for both of you. Anything either of you shared stops being visible right away, and it leaves both
              your Connections lists. To connect again, one of you sends a new invite.
            </p>
            <p className="note">Ember doesn't notify {name}. They'll see the connection is gone the next time they look.</p>
            <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={() => change('ended')}>
              End connection
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmEnd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
