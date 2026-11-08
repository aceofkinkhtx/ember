import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BottomCheckForm } from '../../components/live/BottomCheckForm';
import { Chips } from '../../components/intake/Bits';
import { circulationCheck, firstAid, redSteps, toolkit } from '../../content/live';
import { phaseColors, phaseLabels, secondPeakColor } from '../../content/phases';
import {
  aloudList,
  beatElapsedMs,
  callRed,
  careInfo,
  checkCirculation,
  clock,
  currentBeat,
  elapsedMs,
  goToBeat,
  logMoment,
  maybesIn,
  pause,
  readinessIngredients,
  removeActivities,
  restraint,
  resume,
  safetyKit,
  spaceSet,
  startLive,
  type BottomCheck,
  type ConsentSnapshot,
  type LiveState,
  type LogKind,
  type MaybeItem,
  type TopCheck
} from '../../lib/scene/live';
import { beatsInOrder, type Scene } from '../../lib/scene/model';
import { activityOf, type RuleContext } from '../../lib/scene/rules';
import { clearLocal, keepLocally, readFromBottom, readLocal, sendCheck, sendLive } from '../../lib/liveSync';
import { scheduleAfterScene } from '../../lib/afterScene';
import { listScenes, saveScene } from '../../lib/scenes';
import { shareVibe } from '../../lib/vibes';
import { AccountError } from '../../lib/account';
import { useAccount } from '../../state/account';
import { useSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';

// Live Scene Mode, the Top's side (M6). L1: the pre-scene check, which locks
// the consent snapshot. L2: the guide, one beat at a time, with timers. L3:
// red. L4: the regulation toolkit. L5: the quick log. Pause stops every timer.
// Once started, the scene runs from this phone, so it keeps working offline.

function useTick(ms: number, on = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms, on]);
  return now;
}

/** Keeps the screen awake while the scene runs, where the phone allows it. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const take = () => {
      (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    };
    take();
    const again = () => document.visibilityState === 'visible' && take();
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}

export function LiveScene() {
  const { id = '' } = useParams();
  const { keys } = useAccount();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const current = useRef<Scene | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const { data } = useSceneData(scene?.connectionId ?? null, scene?.partnerId ?? null, scene?.role ?? 'top');
  const { settings } = useSettings();

  useEffect(() => {
    if (!keys) return;
    const local = readLocal(id);
    listScenes(keys)
      .then((all) => {
        const remote = all.find((s) => s.id === id) ?? null;
        // A scene running on this phone wins: it may hold changes made offline.
        const pick = local?.live && !local.live.endedAt ? local : remote;
        current.current = pick;
        setScene(pick);
      })
      .catch(() => {
        current.current = local;
        setScene(local);
      });
  }, [keys, id]);

  /** Every change: kept on this phone at once, saved and sent when online. */
  const update = useCallback(
    (next: Scene) => {
      current.current = next;
      setScene(next);
      if (next.live && !next.live.endedAt) keepLocally(next);
      if (next.live && next.share && next.partnerId) void sendLive(next.share.id, next.partnerId, next.live, next);
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        if (keys && current.current) void saveScene(keys, current.current).catch(() => {});
      }, 1500);
    },
    [keys]
  );

  const fallback: RuleContext = { intake: null, top: settings.top, optedOutGear: [], gear: [] };
  const ctx = data?.ctx ?? fallback;

  if (scene === undefined) {
    return (
      <Dark>
        <p className="note">Loading...</p>
      </Dark>
    );
  }
  if (!scene || scene.role !== 'top') {
    return (
      <Dark>
        <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Scenes
        </Link>
        <p className="card">That scene isn't available to run on this phone.</p>
      </Dark>
    );
  }
  if (!scene.live) return <PreCheck scene={scene} ctx={ctx} loading={data === undefined} onStart={update} onChange={update} />;
  if (scene.live.endedAt) return <Finished scene={scene} />;
  return <Guide scene={scene} ctx={ctx} onChange={update} gearLabel={(gid) => (gid ? (data?.gear.find((g) => g.id === gid)?.name ?? null) : null)} />;
}

function Dark({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const before = meta?.getAttribute('content');
    meta?.setAttribute('content', '#141012');
    return () => {
      if (before) meta?.setAttribute('content', before);
    };
  }, []);
  return (
    <div data-theme="live" className="live-root">
      <main className="screen" style={style}>
        {children}
      </main>
    </div>
  );
}

// L1: the pre-scene check --------------------------------------------------------

function PreCheck({ scene, ctx, loading, onStart, onChange }: { scene: Scene; ctx: RuleContext; loading: boolean; onStart: (s: Scene) => void; onChange: (s: Scene) => void }) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const name = scene.partnerName || 'them';
  const maybes = maybesIn(scene, ctx);
  const [top, setTop] = useState<TopCheck>({ capacity: 0, kit: [], space: [] });
  const [aloud, setAloud] = useState<string[]>([]);
  const [answer, setAnswer] = useState<BottomCheck | null>(null);
  const [handover, setHandover] = useState(false);
  const [talked, setTalked] = useState<Record<string, 'keep' | 'remove'>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const asked = Boolean(scene.checkAskedAt && scene.share);
  const now = useTick(5000, asked && !answer);

  // The bottom's answers arrive from their phone.
  useEffect(() => {
    if (!keys || !asked || answer || !scene.share) return;
    void readFromBottom(keys, scene.share.id).then((r) => r?.answer && setAnswer(r.answer));
  }, [keys, asked, answer, scene.share, now]);

  async function ask() {
    if (!keys || !scene.partnerId) return;
    setBusy(true);
    setError('');
    try {
      const shared = scene.share ? scene : await shareVibe(keys, scene, settings.top.settings.phaseColors);
      await sendCheck(shared.share!.id, scene.partnerId, { maybes: maybes.map((m) => ({ activityId: m.activityId, label: m.label })), askedAt: new Date().toISOString() });
      onChange({ ...shared, checkAskedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't send. Check your connection, or answer together on this phone.");
    } finally {
      setBusy(false);
    }
  }

  const items = aloudList(scene, ctx.intake);
  const answerOf = (m: MaybeItem) => answer?.maybes[m.activityId] ?? null;
  const toTalk = maybes.filter((m) => answerOf(m) === 'talk' && !talked[m.activityId]);
  const removed = maybes.filter((m) => answerOf(m) === 'no' || (answerOf(m) === 'talk' && talked[m.activityId] === 'remove')).map((m) => m.activityId);
  const missing = [
    !answer && `${name}'s part`,
    toTalk.length && `talking through ${toTalk.length === 1 ? 'one maybe' : `${toTalk.length} maybes`}`,
    !top.capacity && 'your capacity today',
    top.kit.length < safetyKit.length && 'the safety kit',
    aloud.length < items.length && 'the list to say aloud'
  ].filter(Boolean) as string[];

  function start() {
    if (!answer) return;
    const now = new Date().toISOString();
    const snapshot: ConsentSnapshot = {
      lockedAt: now,
      intakeVersion: scene.intakeVersion,
      top,
      bottom: answer,
      aloud: items.map((i) => i.text),
      maybes: maybes.map((m) => ({ ...m, answer: answerOf(m) })),
      removed,
      care: careInfo(ctx.intake)
    };
    const planned = removeActivities(scene, removed);
    onStart({ ...planned, live: startLive(planned, ctx, snapshot, now) });
  }

  if (handover) {
    return (
      <Dark>
        <h1 style={{ margin: 0 }}>{name}'s part</h1>
        <p className="lede">Hand the phone to {name}. Their answers stay with this scene.</p>
        <BottomCheckForm
          topName="your Top"
          maybes={maybes}
          onTopPhone
          onSend={async (c) => {
            setAnswer(c);
            setHandover(false);
            return null;
          }}
        />
        <button type="button" className="btn btn-quiet" onClick={() => setHandover(false)}>
          Cancel
        </button>
      </Dark>
    );
  }

  return (
    <Dark>
      <Link to={`/scenes/${scene.id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Design
      </Link>
      <div>
        <h1 style={{ margin: 0 }}>Before you start</h1>
        <p className="note" style={{ margin: '4px 0 0' }}>
          {scene.title}. Under two minutes, mostly taps. Starting locks today's consent snapshot.
        </p>
      </div>
      {loading && <p className="note">Loading {name}'s answers...</p>}

      <section className="card stack" style={{ gap: 10 }} aria-label={`${name}'s part`}>
        <div className="eyebrow">{name}'s part</div>
        {answer ? (
          <BottomSummary answer={answer} maybes={maybes} talked={talked} onTalked={(id, v) => setTalked({ ...talked, [id]: v })} />
        ) : (
          <>
            <p className="setting-desc" style={{ margin: 0 }}>
              How they are today, their readiness, and a yes or no to {maybes.length === 1 ? 'the one maybe' : maybes.length ? `the ${maybes.length} maybes` : 'anything new'} in the plan.
            </p>
            {maybes.length > 0 && (
              <p className="box box-warn" style={{ margin: 0 }}>
                Maybes in the plan: {maybes.map((m) => m.label).join(', ')}. {name} sees these by name and must say yes or no before you start.
              </p>
            )}
            {scene.partnerId &&
              (asked ? (
                <p className="note" style={{ margin: 0 }}>
                  Sent to {name}'s phone. Waiting for their answers...
                </p>
              ) : (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void ask()}>
                  Send the check to {name}'s phone
                </button>
              ))}
            <button type="button" className="btn btn-outline" onClick={() => setHandover(true)}>
              Answer together on this phone
            </button>
          </>
        )}
        {error && (
          <p className="note error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="card stack" style={{ gap: 12 }} aria-label="Your part">
        <div className="eyebrow">Your part</div>
        <Capacity value={top.capacity} onChange={(capacity) => setTop({ ...top, capacity })} />
        {top.capacity > 0 && top.capacity <= 2 && (
          <p className="box box-warn" style={{ margin: 0 }}>
            Low capacity today. A shorter or gentler scene is a good call, and so is another day.
          </p>
        )}
        <Chips legend="Safety kit ready" hint="All four, within reach." options={safetyKit.map((k) => ({ id: k, label: k }))} value={top.kit} onChange={(kit) => setTop({ ...top, kit })} />
        <Chips legend="Space set" hint="Whatever this scene needs." options={spaceSet.map((k) => ({ id: k, label: k }))} value={top.space} onChange={(space) => setTop({ ...top, space })} />
      </section>

      <section className="card stack" style={{ gap: 10 }} aria-label="Say aloud together">
        <div className="eyebrow">Say aloud together</div>
        {items.map((i) => (
          <label key={i.id} className="choice" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={aloud.includes(i.id)} onChange={(e) => setAloud(e.target.checked ? [...aloud, i.id] : aloud.filter((x) => x !== i.id))} style={{ width: 22, height: 22, flex: '0 0 auto' }} />
            <span>{i.text}</span>
          </label>
        ))}
      </section>

      {missing.length > 0 && <p className="note">Still to do: {missing.join(', ')}.</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={missing.length > 0} onClick={start} style={{ minHeight: 56, fontSize: 18 }}>
        Start the scene
      </button>
    </Dark>
  );
}

function Capacity({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="field">
      <span className="field-label" style={{ fontSize: 16 }}>
        Your energy and focus today
      </span>
      <div className="segmented" role="radiogroup" aria-label="Your energy and focus today, 1 to 5" style={{ alignSelf: 'flex-start' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <span className="note">1 is running on empty, 5 is fully here</span>
    </div>
  );
}

function BottomSummary({
  answer,
  maybes,
  talked,
  onTalked
}: {
  answer: BottomCheck;
  maybes: MaybeItem[];
  talked: Record<string, 'keep' | 'remove'>;
  onTalked: (id: string, v: 'keep' | 'remove') => void;
}) {
  const low = (n: number) => n > 0 && n <= 2;
  const lowOnes = [answer.feeling, answer.body, answer.emotion, answer.excitement].some(low);
  const notHere = readinessIngredients.filter((r) => !answer.readiness.includes(r));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p style={{ margin: 0 }}>
        Feeling {answer.feeling} of 5, body {answer.body}, emotionally {answer.emotion}, excitement {answer.excitement}.
        {answer.onTopPhone ? ' Answered on this phone.' : ''}
      </p>
      {lowOnes && <p className="box box-warn" style={{ margin: 0 }}>Something is low today. Talk about it before you start, and scale down or wait if it helps.</p>}
      {!answer.finalNegotiation && <p className="box box-warn" style={{ margin: 0 }}>They haven't had a final negotiation. Have it now, before you start.</p>}
      {answer.bodyNote && <p style={{ margin: 0 }}>Body today: {answer.bodyNote}</p>}
      {answer.emotionNote && <p style={{ margin: 0 }}>On their mind: {answer.emotionNote}</p>}
      {answer.anythingNew && <p className="box box-warn" style={{ margin: 0 }}>New since you last talked: {answer.newNote || 'yes, ask them'}</p>}
      {notHere.length > 0 && <p style={{ margin: 0 }}>Not here today: {notHere.join(', ').toLowerCase()}. Worth a word.</p>}
      {maybes.map((m) => {
        const a = answer.maybes[m.activityId];
        return (
          <div key={m.activityId} className="person" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>
              <strong>{m.label}:</strong> {a === 'yes' ? 'yes' : a === 'no' ? 'no, it comes out of the plan' : a === 'talk' ? "let's talk" : 'no answer'}
            </span>
            {a === 'talk' && (
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="chip" aria-pressed={talked[m.activityId] === 'keep'} onClick={() => onTalked(m.activityId, 'keep')}>
                  Talked: keep it
                </button>
                <button type="button" className="chip" aria-pressed={talked[m.activityId] === 'remove'} onClick={() => onTalked(m.activityId, 'remove')}>
                  Take it out
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// L2: the guide ------------------------------------------------------------------

type Overlay = 'toolkit' | 'log' | null;

function Guide({ scene, ctx, onChange, gearLabel }: { scene: Scene; ctx: RuleContext; onChange: (s: Scene) => void; gearLabel: (id: string | null) => string | null }) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const live = scene.live!;
  const now = useTick(1000);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tab, setTab] = useState<'do' | 'say' | 'watch' | 'notes'>('do');
  const [banner, setBanner] = useState('');
  const seen = useRef<{ red: string | null; yellow: string | null } | null>(null);
  const autoToolkitFor = useRef<number | null>(null);
  useWakeLock(true);

  const set = useCallback((next: LiveState) => onChange({ ...scene, live: next }), [onChange, scene]);
  const all = beatsInOrder(scene);
  const here = currentBeat(scene, live);
  const colors = phaseColors(settings.top.settings.phaseColors);
  const colorOf = (i: number) => {
    const p = all[i].phase;
    if (p.type !== 'peak') return colors[p.type];
    const nth = scene.phases.filter((x) => x.type === 'peak').indexOf(p);
    return nth > 0 ? (settings.top.settings.phaseColors.peak ? colors.peak : secondPeakColor) : colors.peak;
  };
  const name = scene.partnerName || 'They';
  const care = live.snapshot.care;

  // Signals from the bottom's phone.
  const poll = useTick(4000, Boolean(scene.share));
  useEffect(() => {
    if (!keys || !scene.share) return;
    void readFromBottom(keys, scene.share.id).then((r) => {
      if (!r) return;
      const sig = r.signal ?? { red: null, yellows: [] };
      const yellow = sig.yellows.at(-1) ?? null;
      if (!seen.current) {
        seen.current = { red: sig.red, yellow };
        return;
      }
      if (sig.red && sig.red !== seen.current.red) {
        set(callRed(scene.live!, new Date().toISOString(), true));
        setBanner(`${name} pressed red on their phone.`);
      } else if (yellow && yellow !== seen.current.yellow) {
        set(logMoment(scene.live!, 'their-yellow', new Date().toISOString()));
        setBanner(`${name} pressed yellow on their phone. Slow down and check in.`);
        setOverlay('toolkit');
      }
      seen.current = { red: sig.red, yellow };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll, keys]);

  // The toolkit opens by itself in a recovery beat.
  useEffect(() => {
    if (here.phase.type === 'recovery' && autoToolkitFor.current !== live.beat) {
      autoToolkitFor.current = live.beat;
      setOverlay('toolkit');
    }
  }, [here.phase.type, live.beat]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(''), 8000);
    return () => window.clearTimeout(t);
  }, [banner]);

  const beatMs = beatElapsedMs(live, now);
  const over = beatMs > here.beat.minutes * 60000;
  const bound = restraint(live, now);
  const last = live.beat >= all.length - 1;
  const iso = () => new Date().toISOString();
  const go = (i: number) => set(goToBeat(scene, ctx, live, i, Date.now()));
  const steps = here.beat.steps;
  const label = (activityId: string | null) => activityOf(ctx, activityId)?.label ?? null;

  if (live.red) {
    return (
      <RedScreen
        scene={scene}
        byThem={live.log.at(-1)?.kind === 'their-red'}
        onAftercare={() => {
          const first = all.findIndex((b) => b.phase.type === 'aftercare');
          const resumed = resume(live, iso());
          set(first >= 0 ? goToBeat(scene, ctx, resumed, first, Date.now()) : resumed);
        }}
        onResume={() => set(resume(live, iso()))}
      />
    );
  }

  return (
    <div data-theme="live" className="live-root">
      <header className="live-head" style={{ borderBottom: `4px solid ${colorOf(live.beat)}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{scene.title}</div>
          <div className="note" style={{ margin: 0 }}>
            {phaseLabels[here.phase.type]} · {clock(elapsedMs(live, now))}
          </div>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => set(pause(live, iso()))}>
          Pause
        </button>
      </header>

      <main className="screen live-body">
        {banner && (
          <p className="box box-warn" role="alert" style={{ margin: 0 }}>
            {banner}
          </p>
        )}
        {care.signals && (
          <div className="chips" aria-label="Signals">
            <span className="signal" style={{ background: '#2E6B2E' }}>{care.signals.green}</span>
            <span className="signal" style={{ background: '#B7791F' }}>{care.signals.yellow}</span>
            <span className="signal" style={{ background: '#B3261E' }}>{care.signals.red}</span>
            {care.signals.handSign && <span className="signal" style={{ background: '#3a3034' }}>{care.signals.handSign}</span>}
          </div>
        )}
        <CareStrip care={care} />

        {bound && (
          <div className={`box ${bound.checkDue ? 'box-warn' : 'box-info'}`} role={bound.checkDue ? 'alert' : undefined} style={{ margin: 0 }}>
            <strong>Restrained {clock(bound.ms)}.</strong> {bound.checkDue ? circulationCheck : 'Never leave them alone.'}
            {bound.checkDue && (
              <button type="button" className="btn btn-secondary" style={{ display: 'block', marginTop: 8 }} onClick={() => set(checkCirculation(live, Date.now()))}>
                Checked
              </button>
            )}
          </div>
        )}

        <article className="card stack live-beat" style={{ gap: 10, borderTop: `6px solid ${colorOf(live.beat)}` }} aria-label={here.beat.title || 'Beat'}>
          <div className="person">
            <span className="eyebrow" style={{ color: 'var(--text-muted)' }}>
              {phaseLabels[here.phase.type]} · beat {live.beat + 1} of {all.length}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: over ? '#ffb347' : undefined }} aria-label="Time in this beat">
              {clock(beatMs)} / {here.beat.minutes}:00
            </span>
          </div>
          <h2 style={{ margin: 0 }}>{here.beat.title || 'Untitled beat'}</h2>
          <span className="note">Intensity {here.beat.intensity} of 10</span>
          {here.beat.flags.map((f, k) => (
            <p key={k} className={`box box-${f.kind}`} style={{ margin: 0 }}>
              {f.text}
            </p>
          ))}
          <div className="segmented" role="tablist" aria-label="Beat details">
            {(['do', 'say', 'watch', 'notes'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-checked={tab === t} onClick={() => setTab(t)}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <ol className="stack" style={{ gap: 10, margin: 0, paddingLeft: 20 }}>
            {steps.map((s) => {
              const text = tab === 'do' ? s.do : tab === 'say' ? s.say : tab === 'watch' ? s.watch : s.notes;
              // The activity's name, unless the step already starts with it.
              const name = label(s.activityId);
              const what = [name && !s.do.toLowerCase().startsWith(name.toLowerCase()) ? name : null, gearLabel(s.gearId)].filter(Boolean).join(', ');
              return (
                <li key={s.id} style={{ fontSize: 18, lineHeight: 1.45 }}>
                  {what && tab === 'do' && <strong style={{ display: 'block' }}>{what}{s.surprise ? ' (surprise)' : ''}</strong>}
                  {text || <span className="note">Nothing here.</span>}
                </li>
              );
            })}
            {!steps.length && <li className="note">No steps in this beat.</li>}
          </ol>
        </article>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" style={{ flex: 1, minHeight: 56 }} disabled={live.beat === 0} onClick={() => go(live.beat - 1)}>
            ‹ Back
          </button>
          {last ? (
            <button type="button" className="btn btn-primary" style={{ flex: 2, minHeight: 56 }} onClick={() => set({ ...live, endedAt: iso() })}>
              Finish the scene
            </button>
          ) : (
            <button type="button" className="btn btn-primary" style={{ flex: 2, minHeight: 56 }} onClick={() => go(live.beat + 1)}>
              Next beat ›
            </button>
          )}
        </div>

        <nav className="live-dots" aria-label="Phases">
          {scene.phases.map((p) => {
            const first = all.findIndex((b) => b.phase.id === p.id);
            if (first < 0) return null;
            const active = here.phase.id === p.id;
            return (
              <button key={p.id} type="button" aria-label={`Go to ${phaseLabels[p.type]}`} aria-current={active || undefined} onClick={() => go(first)} style={{ background: colorOf(first), outline: active ? '3px solid var(--text)' : 'none' }} />
            );
          })}
        </nav>
      </main>

      <div className="live-actions">
        <button type="button" className="live-red" onClick={() => set(callRed(live, iso()))}>
          Red
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOverlay('toolkit')}>
          Toolkit
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOverlay('log')}>
          Log
        </button>
      </div>

      {overlay === 'toolkit' && <ToolkitSheet onClose={() => setOverlay(null)} />}
      {overlay === 'log' && (
        <LogSheet
          live={live}
          onLog={(kind, text) => {
            set(logMoment(live, kind, iso(), text));
            setOverlay(kind === 'yellow' ? 'toolkit' : null);
          }}
          onClose={() => setOverlay(null)}
        />
      )}
      {live.pausedAt && (
        <div className="live-paused" role="dialog" aria-modal="true" aria-label="Paused">
          <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Paused</p>
          <p className="note">Every timer has stopped.</p>
          <button type="button" className="btn btn-primary" style={{ minHeight: 56, minWidth: 200 }} onClick={() => set(resume(live, iso()))}>
            Resume
          </button>
        </div>
      )}
    </div>
  );
}

/** The limit strip and body notes, from the snapshot, so it works offline. */
function CareStrip({ care }: { care: ConsentSnapshot['care'] }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      {care.limits.hard.length > 0 && (
        <p className="strip" style={{ background: '#B3261E', color: '#fff' }}>
          <strong>No:</strong> {care.limits.hard.join(', ')}
        </p>
      )}
      {care.limits.soft.length > 0 && (
        <p className="strip" style={{ background: '#E8A317', color: '#1d1406' }}>
          <strong>Maybe:</strong> {care.limits.soft.join(', ')}
        </p>
      )}
      {care.body && (
        <p className="strip" style={{ background: '#1a3a6b', color: '#fff' }}>
          <strong>Body:</strong> {care.body}
        </p>
      )}
    </div>
  );
}

// L3: red ------------------------------------------------------------------------

function RedScreen({ scene, byThem, onAftercare, onResume }: { scene: Scene; byThem: boolean; onAftercare: () => void; onResume: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const care = scene.live!.snapshot.care;
  const name = scene.partnerName || 'them';
  const aftercareBeats = scene.phases.filter((p) => p.type === 'aftercare').flatMap((p) => p.beats.map((b) => b.title)).filter(Boolean);
  const e = care.emergency;
  useWakeLock(true);
  return (
    <div className="live-redscreen" role="alertdialog" aria-modal="true" aria-labelledby="red-title">
      <main className="screen" style={{ background: 'transparent' }}>
        <h1 id="red-title" style={{ fontSize: 44, margin: 0, color: '#fff' }}>
          Stop. Check in.
        </h1>
        {byThem && <p style={{ margin: 0, fontWeight: 700 }}>{name} pressed red on their phone.</p>}
        <ol className="stack" style={{ gap: 8, paddingLeft: 22, margin: 0, fontSize: 18 }}>
          {redSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <section className="red-card">
          <h2>Their aftercare</h2>
          <p>{[...care.aftercare, ...aftercareBeats].join(', ') || 'Ask what they need: water, a blanket, closeness or space.'}</p>
          {care.overwhelm.length > 0 && (
            <>
              <h2>If they're overwhelmed</h2>
              <p>{care.overwhelm.join('. ')}</p>
            </>
          )}
          {care.body && (
            <>
              <h2>Body notes</h2>
              <p>{care.body}</p>
            </>
          )}
        </section>

        <section className="red-card">
          <h2>Emergency</h2>
          {e?.kind === 'person' && (
            <a className="btn btn-block red-call" href={`tel:${e.phone.replace(/[^\d+]/g, '')}`}>
              Call {e.name}
            </a>
          )}
          <a className="btn btn-block red-call" href="tel:911">
            Call 911
          </a>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {firstAid.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <button type="button" className="btn btn-block red-primary" onClick={onAftercare}>
          Go to aftercare
        </button>
        {confirming ? (
          <div className="red-card stack" style={{ gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Have you both checked in, and do you both want to go on?</p>
            <button type="button" className="btn btn-block red-ghost" onClick={onResume}>
              Yes, resume the scene
            </button>
            <button type="button" className="btn btn-block red-ghost" onClick={() => setConfirming(false)}>
              Not yet
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-block red-ghost" onClick={() => setConfirming(true)}>
            Resume the scene...
          </button>
        )}
      </main>
    </div>
  );
}

// L4 and L5: toolkit and quick log ----------------------------------------------------

export function ToolkitSheet({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Regulation toolkit" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="person">
          <h2 style={{ margin: 0 }}>Steady the moment</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
        {toolkit.map((g) => (
          <section key={g.id} className="stack" style={{ gap: 8 }} aria-label={g.label}>
            <div className="eyebrow">{g.label}</div>
            {g.prompts.map((p) => {
              const key = `${g.id}:${p.title}`;
              return (
                <button key={key} type="button" className="choice" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)} style={{ minHeight: 56 }}>
                  <span>
                    <span className="choice-word">{p.title}</span>
                    {open === key && (
                      <span className="choice-desc" style={{ display: 'block', fontSize: 17 }}>
                        {p.text}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function LogSheet({ live, onLog, onClose }: { live: LiveState; onLog: (kind: LogKind, text?: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('');
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Quick log" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="person">
          <h2 style={{ margin: 0 }}>Log a moment</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" style={{ flex: 1, minHeight: 56, background: '#B7791F', color: '#fff' }} onClick={() => onLog('yellow')}>
            Yellow
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1, minHeight: 56 }} onClick={() => onLog('highlight')}>
            Highlight
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" aria-label="A note" placeholder="A note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
          <button type="button" className="btn btn-secondary" disabled={!note.trim()} onClick={() => onLog('note', note.trim())}>
            Save
          </button>
        </div>
        <LogList live={live} />
      </div>
    </div>
  );
}

const logWords: Record<LogKind, string> = {
  yellow: 'Yellow',
  highlight: 'Highlight',
  note: 'Note',
  red: 'Red',
  circulation: 'Circulation checked',
  'their-yellow': 'Yellow from their phone',
  'their-red': 'Red from their phone'
};

function LogList({ live }: { live: LiveState }) {
  if (!live.log.length) return null;
  return (
    <ul className="stack" style={{ gap: 4, margin: 0, paddingLeft: 18 }}>
      {[...live.log].reverse().map((l, i) => (
        <li key={i}>
          {new Date(l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}: {logWords[l.kind]}
          {l.text ? `: ${l.text}` : ''}
        </li>
      ))}
    </ul>
  );
}

// After the last beat -----------------------------------------------------------

function Finished({ scene }: { scene: Scene }) {
  const navigate = useNavigate();
  const live = scene.live!;
  useEffect(() => {
    clearLocal();
    // Schedules both people's check-ins: right after, 18 hours, and 3 days of follow-ups.
    if (scene.share) void scheduleAfterScene(scene.share.id).catch(() => {});
  }, [scene.share]);
  return (
    <Dark>
      <h1 style={{ margin: 0 }}>Scene complete</h1>
      <p className="lede">
        {clock(elapsedMs(live, Date.now()))} on the clock. Stay close: aftercare doesn't end with the app.
      </p>
      <section className="card stack" style={{ gap: 8 }} aria-label="Log">
        <div className="eyebrow">What you logged</div>
        {live.log.length ? <LogList live={live} /> : <p className="note">Nothing logged.</p>}
      </section>
      <section className="card stack" style={{ gap: 6 }} aria-label="Consent snapshot">
        <div className="eyebrow">Consent snapshot</div>
        <p style={{ margin: 0 }}>Locked {new Date(live.snapshot.lockedAt).toLocaleString()}.</p>
        {live.snapshot.maybes.length > 0 && <p style={{ margin: 0 }}>Maybes: {live.snapshot.maybes.map((m) => `${m.label} (${m.answer === 'yes' ? 'yes' : m.answer === 'no' ? 'no' : 'talked'})`).join(', ')}.</p>}
      </section>
      {scene.share && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(`/after/${scene.share!.id}`)}>
          Your check-in and debrief
        </button>
      )}
      <button type="button" className="btn btn-outline btn-block" onClick={() => navigate(`/scenes/${scene.id}`)}>
        Back to the design
      </button>
    </Dark>
  );
}
