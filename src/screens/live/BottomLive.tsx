import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BottomCheckForm } from '../../components/live/BottomCheckForm';
import { VibeCurve } from '../../components/scene/VibeView';
import { bottomLive } from '../../content/live';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import { answerCheck, readLive, sendSignal } from '../../lib/liveSync';
import { clock, elapsedMs, progressShare, type BottomSignal, type LiveShare } from '../../lib/scene/live';
import { listSharedVibes, type SharedVibe } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';
import { ToolkitSheet } from './LiveScene';

// Live Scene Mode, the bottom's side (M6). Before: their part of the
// pre-scene check, with every maybe in the plan to say yes or no to. During:
// a simple view with the wave moving along, red and yellow buttons that reach
// the Top's phone, and the regulation toolkit. Never the plan itself.

function useShared(id: string) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [vibe, setVibe] = useState<SharedVibe | null | undefined>(undefined);
  const [top, setTop] = useState<Connection | undefined>(undefined);
  useEffect(() => {
    if (!keys) return;
    Promise.all([listSharedVibes(keys), listConnections(keys, cardFor(settings.identity)).catch(() => [])])
      .then(([v, people]) => {
        const found = v.find((x) => x.id === id) ?? null;
        setVibe(found);
        setTop(people.find((c) => c.otherId === found?.ownerId));
      })
      .catch(() => setVibe(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, id]);
  return { vibe, name: top ? displayName(top) : 'Your Top' };
}

function Dark({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="live" className="live-root">
      <main className="screen">{children}</main>
    </div>
  );
}

/** Their part of the pre-scene check, on their own phone. */
export function BottomCheckPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { vibe, name } = useShared(id);
  if (vibe === undefined) return <Dark><p className="note">Loading...</p></Dark>;
  if (!vibe?.check) {
    return (
      <Dark>
        <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Scenes
        </Link>
        <p className="card">There's no pre-scene check waiting for this scene.</p>
      </Dark>
    );
  }
  return (
    <Dark>
      <Link to={`/vibes/${id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ SceneVibe
      </Link>
      <div>
        <h1 style={{ margin: 0 }}>Before you start</h1>
        <p className="note" style={{ margin: '4px 0 0' }}>
          {vibe.vibe.title}, with {name}. Under two minutes. Only {name} sees your answers.
        </p>
      </div>
      {vibe.answered && <p className="box box-info">You've already sent this. Sending again replaces your answers.</p>}
      <BottomCheckForm
        topName={name}
        maybes={vibe.check.maybes}
        onSend={async (c) => {
          try {
            await answerCheck(vibe.id, vibe.ownerId, c);
            navigate(`/vibes/${vibe.id}/live`, { replace: true });
            return null;
          } catch (err) {
            return err instanceof AccountError ? err.message : "That didn't send. Please try again.";
          }
        }}
      />
    </Dark>
  );
}

/** During the scene: the wave, the signals, the toolkit. */
export function BottomLivePage() {
  const { id = '' } = useParams();
  const { keys } = useAccount();
  const { vibe, name } = useShared(id);
  const [live, setLive] = useState<LiveShare | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [signal, setSignal] = useState<BottomSignal>({ red: null, yellows: [] });
  const [note, setNote] = useState('');
  const [toolkitOpen, setToolkitOpen] = useState(false);

  useEffect(() => {
    if (!keys) return;
    const load = () => void readLive(keys, id).then((l) => l && setLive(l)).catch(() => {});
    load();
    const poll = window.setInterval(load, 4000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [keys, id]);

  // Keep the screen awake while it's open.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  if (vibe === undefined) return <Dark><p className="note">Loading...</p></Dark>;
  if (!vibe) {
    return (
      <Dark>
        <p className="card">This scene isn't available.</p>
      </Dark>
    );
  }

  async function send(kind: 'red' | 'yellow') {
    const at = new Date().toISOString();
    const next = kind === 'red' ? { ...signal, red: at } : { ...signal, yellows: [...signal.yellows, at] };
    setSignal(next);
    try {
      await sendSignal(vibe!.id, vibe!.ownerId, next);
      setNote(kind === 'red' ? bottomLive.redSent : bottomLive.yellowSent);
    } catch {
      setNote(bottomLive.offline);
    }
    if (kind === 'yellow') setToolkitOpen(true);
  }

  const share = live ? progressShare(vibe.vibe.minutes, live, now) : 0;
  const status = !live ? `Waiting for ${name} to start.` : live.endedAt ? 'The scene is complete. Take your time with aftercare.' : live.red ? 'Red. Everything has stopped.' : live.pausedAt ? 'Paused.' : `${clock(elapsedMs(live, now))} in.`;

  return (
    <Dark>
      <Link to={`/vibes/${id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ SceneVibe
      </Link>
      <h1 style={{ margin: 0 }}>{vibe.vibe.title}</h1>
      <p className="lede" aria-live="polite" style={{ margin: 0 }}>
        {status}
      </p>
      <div style={{ position: 'relative' }}>
        <VibeCurve vibe={vibe.vibe} height={120} />
        {live && (
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `${share * 100}%`, width: 3, background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.8)' }} />
        )}
      </div>
      {live?.endedAt && (
        <Link to={`/after/${id}`} className="btn btn-primary btn-block">
          How are you? Three quick taps
        </Link>
      )}
      <p className="note">{bottomLive.intro}</p>
      {note && (
        <p className="box box-info" role="status" style={{ margin: 0 }}>
          {note}
        </p>
      )}
      <button type="button" className="live-red" style={{ width: '100%', minHeight: 88, fontSize: 28 }} onClick={() => void send('red')}>
        {bottomLive.red}
      </button>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn" style={{ flex: 1, minHeight: 64, background: '#B7791F', color: '#fff', fontSize: 20 }} onClick={() => void send('yellow')}>
          {bottomLive.yellow}
        </button>
        <button type="button" className="btn btn-outline" style={{ flex: 1, minHeight: 64 }} onClick={() => setToolkitOpen(true)}>
          Toolkit
        </button>
      </div>
      {toolkitOpen && <ToolkitSheet onClose={() => setToolkitOpen(false)} />}
    </Dark>
  );
}
