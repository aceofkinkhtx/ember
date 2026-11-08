import { Link } from 'react-router-dom';
import { EmberMark } from '../components/EmberMark';
import { DonationPrompt } from '../components/DonationPrompt';
import { RoleToggle } from '../components/RoleToggle';
import { NextScene } from '../components/scene/NextScene';
import { DueCheckIns } from './after/AfterScene';
import { useSettings } from '../state/settings';

// H1 (Top) and BH1 (bottom). Real content arrives with later milestones;
// for now each card says what will live there.

export function Home() {
  const { settings } = useSettings();
  const scene = settings.discreet ? 'plan' : 'scene';
  const isTop = settings.activeRole === 'top';

  return (
    <main className="screen">
      <DonationPrompt />
      <div className="topbar">
        <EmberMark />
        <RoleToggle />
      </div>

      {isTop ? (
        <>
          <h1>What needs you today</h1>
          {!settings.top.offerings.setAt && (
            <div className="card">
              <div className="eyebrow">Your setup</div>
              <div className="card-title">Tell Ember what you offer</div>
              <p className="setting-desc">Scene designs are built only from what you offer and what your partner says yes to.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/me/offerings" className="btn btn-primary">
                  Your offerings
                </Link>
                <Link to="/me/top-settings" className="btn btn-outline">
                  Your settings
                </Link>
              </div>
            </div>
          )}
          <DueCheckIns word={scene} />
          <NextScene role="top" word={scene} empty={`Give a design a date and it shows up here, with a countdown.`} />
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
          <DueCheckIns word={scene} />
          <div className="card">
            <div className="eyebrow">Your profile</div>
            <div className="card-title">Tell your partner what you want</div>
            <p className="setting-desc">Choose quick words, a map, or the detailed form. Every path ends in a profile you control.</p>
            <Link to="/profile" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Start
            </Link>
          </div>
          <NextScene role="bottom" word={scene} empty={`When your Top shares a ${scene}, its SceneVibe appears here.`} />
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
