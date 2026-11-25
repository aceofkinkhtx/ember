import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProposeTarget } from '../ProposeLink';
import { useSettings } from '../../state/settings';

/**
 * "New scene" asks which way to start (Michael, Nov 25): request a scene
 * (say what you'd like and agree it together first), or build one (design it
 * yourself).
 */
export function NewSceneButton({ className = 'btn btn-primary', style }: { className?: string; style?: React.CSSProperties }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const requestTo = useProposeTarget();
  const word = settings.discreet ? 'plan' : 'scene';
  const Word = settings.discreet ? 'Plan' : 'Scene';
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        New {word}
      </button>
      {open && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-scene-title" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 id="new-scene-title" style={{ margin: 0 }}>
              New {word}
            </h2>
            <Link to={requestTo} className="choice" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, textDecoration: 'none', color: 'inherit' }}>
              <span className="choice-word">Request a {Word}</span>
              <span className="note">Say what you'd like to do, feel and experience. You agree on it together before anything is designed.</span>
            </Link>
            <Link to="/scenes/new" className="choice" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, textDecoration: 'none', color: 'inherit' }}>
              <span className="choice-word">Build a {Word}</span>
              <span className="note">Design it yourself: the moments, the activities and the timing.</span>
            </Link>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
