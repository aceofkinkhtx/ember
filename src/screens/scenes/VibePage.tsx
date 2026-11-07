import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { VibeCurve, VibeView } from '../../components/scene/VibeView';
import { phaseLabels } from '../../content/phases';
import { activities } from '../../data/activities';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import { listSharedVibes, planStatus, requestPlan, type SharedVibe } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';

// The bottom's side of M5. BS1: SceneVibes shared with you, in the Scenes tab.
// BS2: one SceneVibe, with Request full plan. BS3: the plan, if the Top sent it.

function useShared() {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [vibes, setVibes] = useState<SharedVibe[] | null>(null);
  const [people, setPeople] = useState<Connection[]>([]);
  useEffect(() => {
    if (!keys) return;
    Promise.all([listSharedVibes(keys), listConnections(keys, cardFor(settings.identity)).catch(() => [])])
      .then(([v, p]) => {
        setVibes(v);
        setPeople(p);
      })
      .catch(() => setVibes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  const from = (ownerId: string) => people.find((c) => c.otherId === ownerId);
  return { vibes, setVibes, from };
}

/** Upcoming SceneVibes from your Tops, for the Scenes tab. */
export function SharedVibes() {
  const { vibes, from } = useShared();
  if (!vibes?.length) return null;
  return (
    <section className="stack" style={{ gap: 10 }} aria-label="SceneVibes shared with you">
      <div className="eyebrow">Shared with you</div>
      {vibes.map((v) => {
        const c = from(v.ownerId);
        const name = c ? displayName(c) : 'Your Top';
        return (
          <Link key={v.id} to={`/vibes/${v.id}`} className="card stack" style={{ gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <div className="person" style={{ gap: 10 }}>
              <Avatar ownerId={v.ownerId} photo={c?.them?.photo} name={name} size={36} />
              <span className="person-name" style={{ flex: 1 }}>
                {v.vibe.title}
              </span>
              <span className="note">{v.vibe.date ? new Date(`${v.vibe.date}T12:00`).toLocaleDateString() : 'No date yet'}</span>
            </div>
            <VibeCurve vibe={v.vibe} height={60} />
            <span className="note">
              From {name}
              {v.check && !v.answered ? '. Pre-scene check waiting for you.' : v.live && !v.live.endedAt ? '. The scene has started.' : ''}
            </span>
          </Link>
        );
      })}
    </section>
  );
}

export function VibePage() {
  const { id = '' } = useParams();
  const { vibes, setVibes, from } = useShared();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shared = vibes?.find((v) => v.id === id);

  if (vibes === null) {
    return (
      <main className="screen">
        <p className="note">Loading...</p>
      </main>
    );
  }
  if (!shared) {
    return (
      <main className="screen">
        <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Scenes
        </Link>
        <p className="card">That SceneVibe isn't available. Your Top may have stopped sharing it.</p>
      </main>
    );
  }

  const c = from(shared.ownerId);
  const name = c ? displayName(c) : 'Your Top';
  const status = planStatus(shared);

  async function ask() {
    setBusy(true);
    setError('');
    try {
      await requestPlan(shared!.id);
      setVibes((all) => (all ?? []).map((v) => (v.id === shared!.id ? { ...v, requestedAt: new Date().toISOString() } : v)));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Scenes
      </Link>
      <div className="person" style={{ gap: 12, justifyContent: 'flex-start' }}>
        <Avatar ownerId={shared.ownerId} photo={c?.them?.photo} name={name} size={44} />
        <p className="lede" style={{ margin: 0 }}>
          {name} designed this for you.
        </p>
      </div>
      {shared.check && (
        <section className="card stack" style={{ gap: 10 }} aria-label="Pre-scene check">
          <div className="eyebrow">Before the scene</div>
          {shared.live && !shared.live.endedAt ? (
            <>
              <p className="setting-desc" style={{ margin: 0 }}>The scene has started.</p>
              <Link to={`/vibes/${shared.id}/live`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Open the live view
              </Link>
            </>
          ) : shared.answered ? (
            <>
              <p className="setting-desc" style={{ margin: 0 }}>You've sent your part of the pre-scene check.</p>
              <Link to={`/vibes/${shared.id}/live`} className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
                Open the live view
              </Link>
            </>
          ) : (
            <>
              <p className="setting-desc" style={{ margin: 0 }}>
                {name} sent the pre-scene check{shared.check.maybes.length ? `, with ${shared.check.maybes.length === 1 ? 'one maybe' : `${shared.check.maybes.length} maybes`} to say yes or no to` : ''}.
              </p>
              <Link to={`/vibes/${shared.id}/check`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Answer the check
              </Link>
            </>
          )}
        </section>
      )}
      <VibeView vibe={shared.vibe} />

      <section className="card stack" style={{ gap: 10 }} aria-label="The full plan">
        <div className="eyebrow">The full plan</div>
        {status === 'sent' ? (
          <>
            <p className="setting-desc" style={{ margin: 0 }}>
              {name} shared the full plan with you.
            </p>
            <Link to={`/vibes/${shared.id}/plan`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Read the plan
            </Link>
          </>
        ) : status === 'requested' ? (
          <p className="setting-desc" style={{ margin: 0 }}>
            Requested. {name} will decide.
          </p>
        ) : status === 'declined' ? (
          <p className="setting-desc" style={{ margin: 0 }}>
            {name} would like to keep it a surprise this time. Your limits and everything you shared still guide every part of it.
          </p>
        ) : (
          <>
            <p className="setting-desc" style={{ margin: 0 }}>
              The SceneVibe shows the shape, not every detail. You can ask to see the whole plan, and {name} decides.
            </p>
            <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => void ask()}>
              Request full plan
            </button>
          </>
        )}
        {error && (
          <p className="note error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

/** BS3: the plan as the Top sent it, read only. */
export function PlanPage() {
  const { id = '' } = useParams();
  const { vibes, from } = useShared();
  const shared = vibes?.find((v) => v.id === id);
  if (vibes === null) {
    return (
      <main className="screen">
        <p className="note">Loading...</p>
      </main>
    );
  }
  const plan = shared?.plan;
  if (!shared || !plan) {
    return (
      <main className="screen">
        <Link to={`/vibes/${id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ SceneVibe
        </Link>
        <p className="card">This plan isn't available.</p>
      </main>
    );
  }
  const c = from(shared.ownerId);
  const name = c ? displayName(c) : 'Your Top';
  const label = (activityId: string | null) => activities.find((a) => a.id === activityId)?.label;
  return (
    <main className="screen">
      <Link to={`/vibes/${shared.id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ SceneVibe
      </Link>
      <h1>{plan.title}</h1>
      <p className="lede">The plan {name} shared with you. It can still change as you both check in on the day.</p>
      {plan.phases.map((p) => (
        <section key={p.id} className="card stack" style={{ gap: 10 }} aria-label={phaseLabels[p.type]}>
          <div className="eyebrow">
            {phaseLabels[p.type]} · {p.beats.reduce((n, b) => n + b.minutes, 0)} min
          </div>
          {p.beats.map((b) => (
            <div key={b.id} className="stack" style={{ gap: 4 }}>
              <strong>{b.title || 'Untitled'}</strong>
              <span className="note">
                {b.minutes} min, intensity {b.intensity}
              </span>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {b.steps.map((s) => (
                  <li key={s.id}>
                    {label(s.activityId) && !s.do.toLowerCase().startsWith(label(s.activityId)!.toLowerCase()) ? <strong>{label(s.activityId)}: </strong> : null}
                    {s.do}
                    {s.say && <span className="note" style={{ display: 'block' }}>"{s.say}"</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
