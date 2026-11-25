import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { localDay, tipFor } from '../lib/tips';
import { listNegotiations, type Negotiation } from '../lib/negotiations';
import { listIncomingRequests, listScenes, type IncomingRequest } from '../lib/scenes';
import { cardFor, listConnections } from '../lib/account';
import { displayName } from './Connections';
import { ProposeLink } from '../components/ProposeLink';
import { useAccount } from '../state/account';
import { EmberMark } from '../components/EmberMark';
import { DonationPrompt } from '../components/DonationPrompt';
import { RoleToggle } from '../components/RoleToggle';
import { NextScene } from '../components/scene/NextScene';
import { NewSceneButton } from '../components/scene/NewSceneButton';
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
          <ProposalsWaiting />
          <SentRequests />
          <NextScene role="top" word={scene} empty={`Give a design a date and it shows up here, with a countdown.`} />
          <TipCard />
          <div style={{ display: 'flex', gap: 10 }}>
            <NewSceneButton style={{ flex: 1 }} />
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
          <ProposalsWaiting />
          <SentRequests />
          <div className="card">
            <div className="eyebrow">Your profile</div>
            <div className="card-title">Tell your partner what you want</div>
            <p className="setting-desc">Choose quick words, a map, or the detailed form. Every path ends in a profile you control.</p>
            <Link to="/profile" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              Start
            </Link>
          </div>
          <div className="card">
            <div className="eyebrow">Your next {scene}</div>
            <div className="card-title">Say what you'd like this time</div>
            <p className="setting-desc">List what you'd like to do, feel and experience. Your Top keeps, removes or adds, and once you both agree, they design from it.</p>
            <ProposeLink className="btn btn-outline" style={{ alignSelf: 'flex-start' }} />
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

/** Scene requests and designs waiting for your answer (Michael, Nov 16). */
function ProposalsWaiting() {
  const { keys } = useAccount();
  const [waiting, setWaiting] = useState<Negotiation[]>([]);
  const [designs, setDesigns] = useState<IncomingRequest[]>([]);
  useEffect(() => {
    if (!keys) return;
    listNegotiations(keys)
      .then((all) => setWaiting(all.filter((n) => n.turnId === keys.userId)))
      .catch(() => setWaiting([]));
    listIncomingRequests(keys)
      .then(setDesigns)
      .catch(() => setDesigns([]));
  }, [keys]);
  const count = waiting.length + designs.length;
  if (!count) return null;
  const title =
    count > 1
      ? `${count} scenes are waiting for your answer`
      : waiting.length
        ? 'A scene request is waiting for you'
        : 'A scene design is waiting for you';
  return (
    <section className="card stack" style={{ gap: 8 }} aria-label="Waiting for your answer">
      <div className="eyebrow">Your turn</div>
      <div className="card-title">{title}</div>
      {waiting.map((n) => (
        <Link key={n.id} to={`/negotiations/${n.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          Open the request{n.body.when ? ` "${n.body.when}"` : ''}
        </Link>
      ))}
      {designs.map((d) => (
        <Link key={d.id} to="/scenes" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          See the design "{d.scene.title}"
        </Link>
      ))}
    </section>
  );
}

/**
 * Requests you've sent that are waiting on the other person, and who has them
 * (Michael, Nov 25): scene requests, and designs sent to a Top.
 */
function SentRequests() {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [rows, setRows] = useState<{ id: string; to: string; what: string; href: string }[]>([]);
  useEffect(() => {
    if (!keys) return;
    let live = true;
    Promise.all([
      listNegotiations(keys).catch(() => [] as Negotiation[]),
      listScenes(keys).catch(() => []),
      listConnections(keys, cardFor(settings.identity)).catch(() => [])
    ]).then(([negs, scenes, people]) => {
      if (!live) return;
      const nameOf = (connectionId: string | null) => {
        const c = people.find((x) => x.id === connectionId);
        return c ? displayName(c) : 'your connection';
      };
      setRows([
        ...negs
          .filter((n) => n.status === 'open' && n.turnId && n.turnId !== keys.userId)
          .map((n) => ({ id: n.id, to: nameOf(n.connectionId), what: n.body.when ? `Scene request "${n.body.when}"` : 'Scene request', href: `/negotiations/${n.id}` })),
        ...scenes
          .filter((s) => s.request?.status === 'sent')
          .map((s) => ({ id: s.id, to: s.partnerName || nameOf(s.connectionId), what: `Design "${s.title}"`, href: `/scenes/${s.id}` }))
      ]);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  if (!rows.length) return null;
  return (
    <section className="card stack" style={{ gap: 8 }} aria-label="Waiting on them">
      <div className="eyebrow">Sent, waiting for an answer</div>
      {rows.map((r) => (
        <Link key={r.id} to={r.href} className="person" style={{ textDecoration: 'none', color: 'inherit', minHeight: 'var(--touch)' }}>
          <span>{r.what}</span>
          <span className="note">To {r.to}</span>
        </Link>
      ))}
    </section>
  );
}
