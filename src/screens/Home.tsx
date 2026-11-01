import { Link } from 'react-router-dom';
import { EmberMark } from '../components/EmberMark';
import { RoleToggle } from '../components/RoleToggle';
import { useSettings } from '../state/settings';

// H1 (Top) and BH1 (bottom). Real content arrives with later milestones;
// for now each card says what will live there.

export function Home() {
  const { settings } = useSettings();
  const scene = settings.discreet ? 'plan' : 'scene';
  const isTop = settings.activeRole === 'top';

  return (
    <main className="screen">
      <div className="topbar">
        <EmberMark />
        <RoleToggle />
      </div>

      {isTop ? (
        <>
          <h1>What needs you today</h1>
          <div className="card">
            <div className="eyebrow">Check-ins</div>
            <div className="card-title">Nothing due</div>
            <p className="setting-desc">Check-ins after a {scene} show up here first, about 18 hours later.</p>
          </div>
          <div className="card">
            <div className="eyebrow">Next {scene}</div>
            <div className="card-title">Nothing planned yet</div>
            <p className="setting-desc">Once you connect with someone, you can design your first {scene} together.</p>
          </div>
          <TipCard />
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/scenes" className="btn btn-primary" style={{ flex: 1 }}>
              New {scene}
            </Link>
            <Link to="/connections" className="btn btn-outline" style={{ flex: 1 }}>
              Invite
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1>Your space</h1>
          <p className="lede">Share what you want, own your limits, and see what's coming.</p>
          <div className="card">
            <div className="eyebrow">Your profile</div>
            <div className="card-title">Tell your partner what you want</div>
            <p className="setting-desc">Choose quick words, a map, or the detailed form. Every path ends in a profile you control.</p>
            <Link to="/profile" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Start
            </Link>
          </div>
          <div className="card">
            <div className="eyebrow">Coming up</div>
            <div className="card-title">Nothing planned yet</div>
            <p className="setting-desc">When your Top plans a {scene}, its preview appears here.</p>
          </div>
          <TipCard />
        </>
      )}
    </main>
  );
}

function TipCard() {
  const { settings } = useSettings();
  if (!settings.notifications.dailyTips) return null;
  return (
    <div className="card card-teal">
      <div className="eyebrow">Today's note</div>
      <p>Your daily tip will appear here. The full library arrives in a later update.</p>
    </div>
  );
}
