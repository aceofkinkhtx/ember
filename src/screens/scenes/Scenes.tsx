import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SceneRequests } from '../../components/scene/Requests';
import { MiniCurve, sceneFacts } from '../../components/scene/SceneCurve';
import { tabLabel } from '../../content/copy';
import type { Scene } from '../../lib/scene/model';
import { listScenes } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';

// B1: every scene, past and planned, and the library of saved designs.

type Tab = 'upcoming' | 'past' | 'library';

const today = () => new Date().toISOString().slice(0, 10);

export function sceneTab(scene: Scene): Exclude<Tab, 'library'> {
  return scene.date && scene.date < today() ? 'past' : 'upcoming';
}

export function Scenes() {
  const { settings } = useSettings();
  const { keys, status } = useAccount();
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('upcoming');

  useEffect(() => {
    if (!keys) return;
    listScenes(keys)
      .then(setScenes)
      .catch(() => {
        setScenes([]);
        setError("Ember couldn't load your scenes. Check your connection and try again.");
      });
  }, [keys]);

  const title = tabLabel('scenes', settings.discreet);
  if (status !== 'signed-in') {
    return (
      <main className="screen">
        <h1>{title}</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>Sign in to design scenes. Designs are locked on your phone before they're saved.</p>
          <Link to="/connections" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const shown = (scenes ?? []).filter((s) => (tab === 'library' ? s.inLibrary : sceneTab(s) === tab));
  const ordered = tab === 'upcoming' ? [...shown].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) : shown;

  return (
    <main className="screen">
      <div className="person">
        <h1 style={{ margin: 0 }}>{title}</h1>
        <Link to="/scenes/new" className="btn btn-primary">
          New scene
        </Link>
      </div>
      <SceneRequests />
      <div className="segmented" role="tablist" aria-label="Which scenes" style={{ alignSelf: 'flex-start' }}>
        {(['upcoming', 'past', 'library'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'upcoming' ? 'Upcoming' : t === 'past' ? 'Past' : 'Library'}
          </button>
        ))}
      </div>

      {scenes === null ? (
        <p className="note">Loading...</p>
      ) : ordered.length === 0 ? (
        <div className="card stack">
          <p style={{ margin: 0 }}>
            {tab === 'library'
              ? 'Nothing in your library yet. Turn on "Keep in my library" in any scene to save it here.'
              : tab === 'past'
                ? 'No past scenes yet.'
                : "No scenes planned. Start one from here or from a connection's page."}
          </p>
        </div>
      ) : (
        <ul className="person-list">
          {ordered.map((s) => (
            <li key={s.id}>
              <Link to={`/scenes/${s.id}`} className="card stack" style={{ gap: 6, textDecoration: 'none', color: 'inherit' }}>
                <div className="person">
                  <span className="person-name">{s.title}</span>
                  <span className="note">{s.date ? new Date(`${s.date}T12:00`).toLocaleDateString() : 'No date'}</span>
                </div>
                <MiniCurve scene={s} height={44} />
                {s.request && <span className="tag tag-gray" style={{ alignSelf: 'flex-start' }}>Sent to {s.partnerName}</span>}
                <span className="note">
                  {s.partnerName ? `With ${s.partnerName}. ` : ''}
                  {sceneFacts(s)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
