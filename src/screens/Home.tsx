import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { localDay, tipFor } from '../lib/tips';
import { EmberMark } from '../components/EmberMark';
import { DonationPrompt } from '../components/DonationPrompt';
import { RoleToggle } from '../components/RoleToggle';
import { NextScene } from '../components/scene/NextScene';
import { DueCheckIns } from './after/AfterScene';
import { useSettings } from '../state/settings';

// H1 (Top) and BH1 (bottom).

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

/** Today's tip for the role in view (M8). Turned off with "Daily tips" in Me. */
function TipCard() {
  const { settings, update } = useSettings();
  const today = localDay();
  const startedOn = settings.tipsStartedOn;
  const on = settings.notifications.dailyTips;
  useEffect(() => {
    if (on && !startedOn) update({ tipsStartedOn: today });
  }, [on, startedOn, today, update]);
  if (!on) return null;
  const { tip, day, total } = tipFor(settings.activeRole, startedOn ?? today, today);
  return (
    <section className="card card-teal" aria-labelledby="tip-title">
      <div className="eyebrow" id="tip-title">
        Today's note · {tip.theme}
      </div>
      <p style={{ margin: 0 }}>{tip.text}</p>
      <p className="note" style={{ margin: 0 }}>
        {day} of {total}. A new one each day; turn them off in Me.
      </p>
    </section>
  );
}
