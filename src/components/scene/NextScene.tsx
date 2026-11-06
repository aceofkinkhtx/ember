import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Scene } from '../../lib/scene/model';
import { listScenes } from '../../lib/scenes';
import { listSharedVibes, type SharedVibe } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { MiniCurve } from './SceneCurve';
import { VibeCurve } from './VibeView';

// Home's next-scene card (H1 and BH1), with a countdown. A Top sees their next
// dated design; a bottom sees the next SceneVibe a Top shared with them.

const today = () => new Date().toISOString().slice(0, 10);

/** "Today", "Tomorrow" or "In 5 days". */
export function countdown(date: string, now = new Date()): string {
  const days = Math.round((new Date(`${date}T12:00`).getTime() - new Date(`${now.toISOString().slice(0, 10)}T12:00`).getTime()) / 86_400_000);
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
}

export function NextScene({ role, word, empty }: { role: 'top' | 'bottom'; word: string; empty: string }) {
  const { keys, status } = useAccount();
  const [next, setNext] = useState<{ scene?: Scene; vibe?: SharedVibe } | null | undefined>(undefined);

  useEffect(() => {
    if (!keys) return;
    const soon = <T,>(list: T[], date: (x: T) => string) => list.filter((x) => date(x) >= today()).sort((a, b) => date(a).localeCompare(date(b)))[0];
    if (role === 'top')
      listScenes(keys)
        .then((all) => setNext({ scene: soon(all.filter((s) => s.date && s.role === 'top'), (s) => s.date) }))
        .catch(() => setNext(null));
    else
      listSharedVibes(keys)
        .then((all) => setNext({ vibe: soon(all.filter((v) => v.vibe.date), (v) => v.vibe.date) }))
        .catch(() => setNext(null));
  }, [keys, role]);

  const item = next?.scene ?? next?.vibe;
  if (status !== 'signed-in' || !item) {
    return (
      <div className="card">
        <div className="eyebrow">Next {word}</div>
        <div className="card-title">Nothing planned yet</div>
        <p className="setting-desc">{empty}</p>
      </div>
    );
  }
  const date = next?.scene ? next.scene.date : next!.vibe!.vibe.date;
  const title = next?.scene ? next.scene.title : next!.vibe!.vibe.title;
  const to = next?.scene ? `/scenes/${next.scene.id}` : `/vibes/${next!.vibe!.id}`;
  return (
    <Link to={to} className="card stack" style={{ gap: 8, textDecoration: 'none', color: 'inherit' }}>
      <div className="person">
        <span className="eyebrow">Next {word}</span>
        <span className="tag tag-gray">{countdown(date)}</span>
      </div>
      <div className="card-title" style={{ margin: 0 }}>
        {title}
      </div>
      {next?.scene ? <MiniCurve scene={next.scene} height={44} /> : <VibeCurve vibe={next!.vibe!.vibe} height={60} />}
      <span className="note">{new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
    </Link>
  );
}
