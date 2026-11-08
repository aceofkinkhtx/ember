import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Segments, TextArea } from '../../components/intake/Bits';
import { bottomDebrief, bottomReplies, checkInMessage, topDebrief, topReactions, type BottomReply, type DebriefScale, type TopReaction } from '../../content/afterScene';
import { careSuggestion, careText, checkInQuestions, type Question } from '../../content/checkins';
import { allTopActivities } from '../../content/topSetup';
import { activities as catalog } from '../../data/activities';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import {
  dueNow,
  find,
  listNotes,
  listReminders,
  markDone,
  saveNote,
  scenePeople,
  scheduleAfterScene,
  type ActivityRef,
  type BottomDebrief,
  type FollowUp,
  type Note,
  type PostNote,
  type Reminder,
  type TopDebrief
} from '../../lib/afterScene';
import { listVersions, saveVersion } from '../../lib/intake';
import { sendMessage } from '../../lib/messages';
import type { Scene } from '../../lib/scene/model';
import { listScenes } from '../../lib/scenes';
import { listSharedVibes, sendPlan, type SharedVibe } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';

// M7, after the scene: the check-in right after (both), the debriefs (A2 and
// BA1), profile updates (A3), the Top's check-in about 18 hours later (A4), and
// the follow-ups once a day for 3 days (BA2, for both). Every answer is sealed
// on the phone; each screen says what is shared with the other person.

const five = ['1', '2', '3', '4', '5'].map((id) => ({ id, label: id }));

function Scale({ q, value, onChange }: { q: { prompt: string; low: string; high: string }; value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <Segments label={q.prompt} options={five} value={value ? String(value) : null} onChange={(v) => onChange(Number(v))} />
      <span className="note">
        1 is {q.low.toLowerCase()}, 5 is {q.high.toLowerCase()}
      </span>
    </div>
  );
}

function Shared({ text }: { text: string }) {
  return (
    <p className="note" style={{ margin: 0 }}>
      {text}
    </p>
  );
}

/** Everything a screen needs: who is who, the connection, the notes so far. */
function useAfter(vibeId: string) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [state, setState] = useState<
    | { amTop: boolean; partnerId: string; connection: Connection | null; notes: Note[]; scene: Scene | null; vibe: SharedVibe | null }
    | null
    | undefined
  >(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!keys) return;
    (async () => {
      const people = await scenePeople(keys, vibeId);
      if (!people) return setState(null);
      const [notes, conns, scene, vibe] = await Promise.all([
        listNotes(keys, vibeId),
        listConnections(keys, cardFor(settings.identity)).catch(() => []),
        people.amTop ? listScenes(keys).then((all) => all.find((s) => s.share?.id === vibeId) ?? null) : Promise.resolve(null),
        people.amTop ? Promise.resolve(null) : listSharedVibes(keys).then((all) => all.find((v) => v.id === vibeId) ?? null)
      ]);
      setState({ ...people, connection: conns.find((c) => c.otherId === people.partnerId) ?? null, notes, scene, vibe });
    })().catch(() => setState(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, vibeId, tick]);
  return { state, reload: () => setTick((t) => t + 1) };
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="screen">
      <Link to="/" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Home
      </Link>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

/** The activities in the scene, by the names the Top uses. */
function sceneActivities(scene: Scene, offerings: Parameters<typeof allTopActivities>[0]): ActivityRef[] {
  const all = allTopActivities(offerings);
  const ids = [...new Set(scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps.map((s) => s.activityId)).filter((x): x is string => Boolean(x))))];
  return ids.map((id) => ({ id, label: all.find((a) => a.id === id)?.label ?? id }));
}

/** What the bottom sees: the Top's list if shared, otherwise what the sent plan shows. */
function bottomActivities(notes: Note[], partnerId: string, vibe: SharedVibe | null): ActivityRef[] {
  const fromTop = find(notes, partnerId, 'post')?.shared?.activities as ActivityRef[] | undefined;
  if (fromTop?.length) return fromTop;
  const ids = [...new Set((vibe?.plan?.phases ?? []).flatMap((p) => p.beats.flatMap((b) => b.steps.map((s) => s.activityId))).filter((x): x is string => Boolean(x)))];
  return ids.map((id) => ({ id, label: catalog.find((a) => a.id === id)?.label ?? 'An activity' }));
}

// Right after the scene, and the debriefs -------------------------------------------------

export function AfterScenePage() {
  const { vibeId = '' } = useParams();
  const { state, reload } = useAfter(vibeId);
  if (state === undefined) return <Shell title="After the scene"><p className="note">Loading...</p></Shell>;
  if (state === null) return <Shell title="After the scene"><p className="card">This scene isn't shared between you two anymore.</p></Shell>;
  return state.amTop ? <TopAfter vibeId={vibeId} {...state} onSaved={reload} /> : <BottomAfter vibeId={vibeId} {...state} onSaved={reload} />;
}

type AfterProps = { vibeId: string; partnerId: string; connection: Connection | null; notes: Note[]; scene: Scene | null; vibe: SharedVibe | null; onSaved: () => void };

function PostCheckIn({ role, onSave }: { role: 'top' | 'bottom'; onSave: (n: PostNote) => Promise<void> }) {
  const { settings } = useSettings();
  const qs = checkInQuestions('post', role, settings.discreet).filter((q): q is Extract<Question, { kind: 'scale' }> => q.kind === 'scale');
  const [a, setA] = useState<PostNote>({ feeling: null, attentiveness: null, overall: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const care = a.feeling ? careSuggestion('post', a.feeling) : null;
  return (
    <section className="card stack" style={{ gap: 14 }} aria-label="Right after the scene">
      <div className="eyebrow">Right after</div>
      {qs.map((q) => (
        <Scale key={q.id} q={q} value={a[q.id as keyof PostNote]} onChange={(n) => setA((x) => ({ ...x, [q.id]: n }))} />
      ))}
      {care && <p className="box box-info">{careText[care]}</p>}
      <Shared text={role === 'bottom' ? 'Shared with your Top, so they know how you are.' : 'Just for you.'} />
      {error && <p className="note error" role="alert">{error}</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy || !a.feeling}
        onClick={() => {
          setBusy(true);
          onSave(a).catch((e) => {
            setError(e instanceof AccountError ? e.message : "Ember couldn't save that. Please try again.");
            setBusy(false);
          });
        }}
      >
        Save
      </button>
    </section>
  );
}

function TopAfter({ vibeId, partnerId, connection, notes, scene, onSaved }: AfterProps) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const name = connection ? displayName(connection) : 'them';
  const acts = useMemo(() => (scene ? sceneActivities(scene, settings.top.offerings) : []), [scene, settings.top.offerings]);
  useEffect(() => {
    void scheduleAfterScene(vibeId).catch(() => {});
  }, [vibeId]);
  if (!keys) return null;
  const me = keys.userId;
  const post = find<PostNote>(notes, me, 'post');
  const debrief = find<TopDebrief>(notes, me, 'debrief');
  const theirPost = find(notes, partnerId, 'post');
  const theirDebrief = find(notes, partnerId, 'debrief');

  if (!post)
    return (
      <Shell title="After the scene">
        <p className="lede">Three quick taps while it's fresh. Tops drop too.</p>
        <PostCheckIn
          role="top"
          onSave={async (a) => {
            await saveNote(keys, vibeId, partnerId, 'post', 0, a, { activities: acts });
            await markDone(vibeId, 'post');
            onSaved();
          }}
        />
      </Shell>
    );

  if (!debrief)
    return (
      <Shell title="Your debrief">
        <TopDebriefForm
          acts={acts}
          name={name}
          onSave={async (d, share) => {
            const { self: _self, ...scores } = d.scores;
            const { self: _selfNote, ...notesShared } = d.notes;
            await saveNote(keys, vibeId, partnerId, 'debrief', 0, d, share ? { scores, notes: notesShared, reactions: d.reactions, observations: d.observations } : null);
            onSaved();
          }}
        />
      </Shell>
    );

  return (
    <Shell title="After the scene">
      <p className="lede">Your check-in and debrief are saved. Stay close: aftercare doesn't end with the app.</p>
      {scene && <SendDesign scene={scene} name={name} />}
      <TheirSide name={name} post={theirPost} debrief={theirDebrief} acts={acts} />
      <p className="note">You'll get a reminder to check in with {name} about 18 hours after the scene, and a short follow-up for yourself once a day for 3 days.</p>
      <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/')}>
        Done
      </button>
    </Shell>
  );
}

function TopDebriefForm({ acts, name, onSave }: { acts: ActivityRef[]; name: string; onSave: (d: TopDebrief, share: boolean) => Promise<void> }) {
  const { settings } = useSettings();
  const qs = topDebrief(settings.discreet);
  const [d, setD] = useState<TopDebrief>({ scores: {}, notes: {}, reactions: {}, observations: '' });
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = () => {
    setBusy(true);
    onSave(d, share).catch(() => {
      setError("Ember couldn't save that. Please try again.");
      setBusy(false);
    });
  };
  return (
    <>
      <p className="lede">Sliders with optional notes. Skip anything.</p>
      {qs.map((q: DebriefScale) => (
        <section key={q.id} className="card stack" style={{ gap: 8 }}>
          <Scale q={q} value={d.scores[q.id] ?? null} onChange={(n) => setD((x) => ({ ...x, scores: { ...x.scores, [q.id]: n } }))} />
          <TextArea label={`Notes (optional)${q.private ? ', just for you' : ''}`} rows={2} max={500} value={d.notes[q.id] ?? ''} onChange={(v) => setD((x) => ({ ...x, notes: { ...x.notes, [q.id]: v } }))} />
        </section>
      ))}
      {acts.length > 0 && (
        <section className="card stack" style={{ gap: 12 }} aria-label="What you noticed">
          <div className="eyebrow">What you noticed</div>
          <p className="setting-desc" style={{ margin: 0 }}>
            These go to {name} as suggestions for their profile. Only they can change it.
          </p>
          {acts.map((a) => (
            <div key={a.id} className="stack" style={{ gap: 6 }}>
              <strong>{a.label}</strong>
              <div className="chips">
                {topReactions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="chip"
                    aria-pressed={d.reactions[a.id] === r.id}
                    onClick={() =>
                      setD((x) => {
                        const reactions = { ...x.reactions };
                        if (reactions[a.id] === r.id) delete reactions[a.id];
                        else reactions[a.id] = r.id as TopReaction;
                        return { ...x, reactions };
                      })
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="card stack" style={{ gap: 10 }}>
        <TextArea label="Anything else you observed? (optional)" rows={3} max={1000} value={d.observations} onChange={(observations) => setD((x) => ({ ...x, observations }))} />
        <label className="check" style={{ minHeight: 0 }}>
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Share my debrief with {name} (your own state always stays just for you)
        </label>
      </section>
      {error && <p className="note error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={save}>
        Save debrief
      </button>
    </>
  );
}

/** "Send the real design afterward" (Nov 3): the full plan, surprises included. */
function SendDesign({ scene, name }: { scene: Scene; name: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  return (
    <section className="card stack" style={{ gap: 8 }} aria-label="Send the design">
      <div className="eyebrow">Send the real design</div>
      <p className="setting-desc" style={{ margin: 0 }}>
        Let {name} see what happened, surprises included. Your private notes and records stay with you.
      </p>
      {state === 'sent' ? (
        <p className="note">Sent.</p>
      ) : (
        <button
          type="button"
          className="btn btn-outline"
          style={{ alignSelf: 'flex-start' }}
          disabled={state === 'busy'}
          onClick={() => {
            setState('busy');
            sendPlan(scene, true).then(
              () => setState('sent'),
              () => setState('error')
            );
          }}
        >
          Send it to {name}
        </button>
      )}
      {state === 'error' && <p className="note error">Ember couldn't send it. Please try again.</p>}
    </section>
  );
}

/** A3 and A4: what the bottom shared, and their profile suggestions. */
function TheirSide({ name, post, debrief, acts }: { name: string; post?: Note; debrief?: Note; acts: ActivityRef[] }) {
  const p = post?.shared as Partial<PostNote> | null | undefined;
  const d = debrief?.shared as Partial<BottomDebrief> | null | undefined;
  const label = (id: string) => acts.find((a) => a.id === id)?.label ?? 'An activity';
  return (
    <section className="card stack" style={{ gap: 8 }} aria-label={`From ${name}`}>
      <div className="eyebrow">From {name}</div>
      {!p && !d && <p className="note" style={{ margin: 0 }}>Nothing yet. Their check-in and debrief show up here when they send them.</p>}
      {p?.feeling && (
        <p style={{ margin: 0 }}>
          Right after: feeling {p.feeling} of 5{p.attentiveness ? `, your attentiveness ${p.attentiveness} of 5` : ''}
          {p.overall ? `, overall ${p.overall} of 5` : ''}.
        </p>
      )}
      {p?.feeling && p.feeling <= 2 && <p className="box box-warning">They rated how they feel low. Stay close and check on them.</p>}
      {d && (
        <>
          {d.scores?.['feel-now'] && <p style={{ margin: 0 }}>Later: feeling {d.scores['feel-now']} of 5{d.scores.seen ? `, felt seen ${d.scores.seen} of 5` : ''}.</p>}
          {d.differed && <p style={{ margin: 0 }}>What was different: {d.differed}</p>}
          {d.keep && <p style={{ margin: 0 }}>What to keep: {d.keep}</p>}
          {Object.entries(d.replies ?? {}).map(([id, r]) => (
            <p key={id} className={`box ${r === 'no-now' ? 'box-block' : r === 'talk' ? 'box-warning' : 'box-info'}`}>
              {label(id)}: {bottomReplies.find((x) => x.id === r)?.label}
              {r === 'no-now' ? '. Their profile changes only when they confirm it.' : ''}
            </p>
          ))}
        </>
      )}
    </section>
  );
}

function BottomAfter({ vibeId, partnerId, connection, notes, vibe, onSaved }: AfterProps) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const name = connection ? displayName(connection) : 'your Top';
  useEffect(() => {
    void scheduleAfterScene(vibeId).catch(() => {});
  }, [vibeId]);
  if (!keys) return null;
  const me = keys.userId;
  const post = find(notes, me, 'post');
  const debrief = find<BottomDebrief>(notes, me, 'debrief');
  const acts = bottomActivities(notes, partnerId, vibe);
  const topDebriefShared = find(notes, partnerId, 'debrief')?.shared as Partial<TopDebrief> | null | undefined;

  if (!post)
    return (
      <Shell title="After the scene">
        <p className="lede">Three quick taps, then rest. The longer debrief can wait.</p>
        <PostCheckIn
          role="bottom"
          onSave={async (a) => {
            await saveNote(keys, vibeId, partnerId, 'post', 0, a, { ...a });
            await markDone(vibeId, 'post');
            onSaved();
          }}
        />
      </Shell>
    );

  if (!debrief)
    return (
      <Shell title="Your debrief">
        <BottomDebriefForm
          acts={acts}
          name={name}
          discreet={settings.discreet}
          onSave={async (d) => {
            await saveNote(keys, vibeId, partnerId, 'debrief', 0, d, { ...d });
            await markDone(vibeId, 'debrief');
            onSaved();
          }}
          onLater={() => navigate('/')}
        />
      </Shell>
    );

  return (
    <Shell title="After the scene">
      <p className="lede">Thank you. Your debrief is with {name}.</p>
      <ProfileUpdates replies={debrief.mine?.replies ?? {}} reactions={topDebriefShared?.reactions ?? {}} acts={acts} name={name} />
      {topDebriefShared?.observations && (
        <section className="card stack" style={{ gap: 6 }}>
          <div className="eyebrow">{name} noticed</div>
          <p style={{ margin: 0 }}>{topDebriefShared.observations}</p>
        </section>
      )}
      <p className="note">A short follow-up waits for you once a day for the next 3 days. Drop can show up later, and that's normal.</p>
      <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/')}>
        Done
      </button>
    </Shell>
  );
}

function BottomDebriefForm({ acts, name, discreet, onSave, onLater }: { acts: ActivityRef[]; name: string; discreet: boolean; onSave: (d: BottomDebrief) => Promise<void>; onLater: () => void }) {
  const qs = bottomDebrief(discreet);
  const [d, setD] = useState<BottomDebrief>({ scores: {}, differed: '', keep: '', replies: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <p className="lede">In your own words. Skip anything. Everything here is shared with {name}.</p>
      <section className="card stack" style={{ gap: 14 }}>
        {qs.map((q) => (
          <Scale key={q.id} q={q} value={d.scores[q.id] ?? null} onChange={(n) => setD((x) => ({ ...x, scores: { ...x.scores, [q.id]: n } }))} />
        ))}
      </section>
      {acts.length > 0 && (
        <section className="card stack" style={{ gap: 12 }} aria-label="One tap each">
          <div className="eyebrow">One tap each</div>
          {acts.map((a) => (
            <div key={a.id} className="stack" style={{ gap: 6 }}>
              <strong>{a.label}</strong>
              <div className="chips">
                {bottomReplies.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="chip"
                    aria-pressed={d.replies[a.id] === r.id}
                    onClick={() =>
                      setD((x) => {
                        const replies = { ...x.replies };
                        if (replies[a.id] === r.id) delete replies[a.id];
                        else replies[a.id] = r.id as BottomReply;
                        return { ...x, replies };
                      })
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="card stack" style={{ gap: 10 }}>
        <TextArea label="What was different from what you imagined?" rows={2} max={1000} value={d.differed} onChange={(differed) => setD((x) => ({ ...x, differed }))} />
        <TextArea label="What do you want to keep?" rows={2} max={1000} value={d.keep} onChange={(keep) => setD((x) => ({ ...x, keep }))} />
      </section>
      {error && <p className="note error" role="alert">{error}</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onSave(d).catch(() => {
            setError("Ember couldn't save that. Please try again.");
            setBusy(false);
          });
        }}
      >
        Send my debrief
      </button>
      <button type="button" className="btn btn-quiet btn-block" onClick={onLater}>
        Later
      </button>
    </>
  );
}

/** A3 on the bottom's side: suggestions become changes only when the bottom accepts them. */
function ProfileUpdates({ replies, reactions, acts, name }: { replies: Record<string, BottomReply>; reactions: Record<string, TopReaction>; acts: ActivityRef[]; name: string }) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [done, setDone] = useState<Record<string, string>>({});
  const label = (id: string) => acts.find((a) => a.id === id)?.label ?? 'An activity';
  const cards = [
    ...Object.entries(replies)
      .filter(([, r]) => r === 'no-now')
      .map(([id]) => ({ id, to: 'no' as const, why: `You said this is a no for you now.` })),
    ...Object.entries(reactions)
      .filter(([id, r]) => r === 'not-for-them' && replies[id] !== 'no-now')
      .map(([id]) => ({ id, to: 'maybe' as const, why: `${name} noticed it didn't seem right for you.` }))
  ];
  if (!cards.length) return null;

  async function apply(id: string, to: 'no' | 'maybe') {
    if (!keys) return;
    try {
      const versions = await listVersions(keys);
      const latest = versions.sort((a, b) => b.version - a.version)[0];
      if (!latest?.intake.detailed) throw new AccountError('Your profile has no detailed answers to change yet.');
      const intake = structuredClone(latest.intake);
      intake.detailed!.answers[id] = { ...intake.detailed!.answers[id], choice: to };
      await saveVersion(keys, settings.identity, { intake, basedOn: { id: latest.id, version: latest.version } });
      setDone((d) => ({ ...d, [id]: `Changed to ${to}.` }));
    } catch (e) {
      setDone((d) => ({ ...d, [id]: e instanceof AccountError ? e.message : "Ember couldn't change your profile. Please try again." }));
    }
  }

  return (
    <section className="card stack" style={{ gap: 10 }} aria-label="Profile updates">
      <div className="eyebrow">Update your profile?</div>
      <p className="setting-desc" style={{ margin: 0 }}>
        Only you can change your profile. Each change saves a new, dated version.
      </p>
      {cards.map((c) => (
        <div key={c.id} className="stack" style={{ gap: 6 }}>
          <strong>{label(c.id)}</strong>
          <span className="note">{c.why}</span>
          {done[c.id] ? (
            <span className="note">{done[c.id]}</span>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={() => void apply(c.id, c.to)}>
                Change it to {c.to}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setDone((d) => ({ ...d, [c.id]: 'Kept as it is.' }))}>
                Keep it
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// Follow-ups, once a day for 3 days (both) -------------------------------------------------

export function FollowUpPage() {
  const { vibeId = '', day = '1' } = useParams();
  const n = Math.min(3, Math.max(1, Number(day) || 1));
  const { keys } = useAccount();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { state, reload } = useAfter(vibeId);
  const [a, setA] = useState<FollowUp>({ feeling: null, changed: null, changedNote: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  if (state === undefined) return <Shell title="Follow-up"><p className="note">Loading...</p></Shell>;
  if (state === null || !keys) return <Shell title="Follow-up"><p className="card">This scene isn't shared between you two anymore.</p></Shell>;
  const role = state.amTop ? 'top' : 'bottom';
  const name = state.connection ? displayName(state.connection) : state.amTop ? 'your bottom' : 'your Top';
  const qs = checkInQuestions('followup', role, settings.discreet);
  const mine = find<FollowUp>(state.notes, keys.userId, 'followup', n);
  const theirs = find(state.notes, state.partnerId, 'followup', n)?.shared as { notes?: string } | null | undefined;
  const feeling = mine?.mine?.feeling ?? a.feeling;
  const care = feeling ? careSuggestion('followup', feeling) : null;

  return (
    <Shell title={`Day ${n} follow-up`}>
      {theirs?.notes && (
        <section className="card stack" style={{ gap: 6 }}>
          <div className="eyebrow">From {name}</div>
          <p style={{ margin: 0 }}>{theirs.notes}</p>
        </section>
      )}
      {mine || saved ? (
        <p className="card">Saved. Thank you for checking in with yourself.</p>
      ) : (
        <section className="card stack" style={{ gap: 14 }}>
          {qs.map((q) =>
            q.kind === 'scale' ? (
              <Scale key={q.id} q={q} value={a.feeling} onChange={(feeling) => setA((x) => ({ ...x, feeling }))} />
            ) : q.kind === 'yesno' ? (
              <div key={q.id} className="stack" style={{ gap: 8 }}>
                <Segments label={q.prompt} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} value={a.changed === null ? null : a.changed ? 'yes' : 'no'} onChange={(v) => setA((x) => ({ ...x, changed: v === 'yes' }))} />
                {a.changed && q.noteIfYes && <TextArea label={q.noteIfYes} rows={2} max={500} value={a.changedNote} onChange={(changedNote) => setA((x) => ({ ...x, changedNote }))} />}
              </div>
            ) : (
              <TextArea key={q.id} label={q.prompt} hint={q.hint.replace('them', name)} rows={2} max={1000} value={a.notes} onChange={(notes) => setA((x) => ({ ...x, notes }))} />
            )
          )}
          <Shared text={`Only your notes are shared with ${name}. The rest is just for you.`} />
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy || !a.feeling}
            onClick={async () => {
              setBusy(true);
              try {
                await saveNote(keys, vibeId, state.partnerId, 'followup', n, a, a.notes.trim() ? { notes: a.notes.trim() } : null);
                await markDone(vibeId, 'followup', n);
                setSaved(true);
                reload();
              } catch {
                setBusy(false);
              }
            }}
          >
            Save
          </button>
        </section>
      )}
      {care && (
        <section className="card stack" style={{ gap: 10 }}>
          <p style={{ margin: 0 }}>{careText[care]}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {state.connection && (
              <Link className="btn btn-primary" to={`/connections/${state.connection.id}/messages`}>
                Message {name}
              </Link>
            )}
            <a className="btn btn-outline" href="sms:">
              Text someone you trust
            </a>
          </div>
        </section>
      )}
      <button type="button" className="btn btn-quiet btn-block" onClick={() => navigate('/')}>
        Back to Home
      </button>
    </Shell>
  );
}

// A4: the Top's check-in, about 18 hours later ----------------------------------------------

export function TopCheckInPage() {
  const { vibeId = '' } = useParams();
  const { keys } = useAccount();
  const navigate = useNavigate();
  const { state } = useAfter(vibeId);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { settings } = useSettings();
  const acts = useMemo(() => (state?.scene ? sceneActivities(state.scene, settings.top.offerings) : []), [state?.scene, settings.top.offerings]);
  if (state === undefined) return <Shell title="Check in"><p className="note">Loading...</p></Shell>;
  if (state === null || !keys || !state.amTop) return <Shell title="Check in"><p className="card">This check-in isn't available.</p></Shell>;
  const name = state.connection ? displayName(state.connection) : 'them';
  const message = text ?? checkInMessage(state.connection?.them?.name ?? '');
  const followNotes = [1, 2, 3].map((d) => ({ d, n: (find(state.notes, state.partnerId, 'followup', d)?.shared as { notes?: string } | null)?.notes })).filter((x) => x.n);

  return (
    <Shell title={`Check in with ${name}`}>
      <TheirSide name={name} post={find(state.notes, state.partnerId, 'post')} debrief={find(state.notes, state.partnerId, 'debrief')} acts={acts} />
      {followNotes.map((f) => (
        <p key={f.d} className="card" style={{ margin: 0 }}>
          Day {f.d}: {f.n}
        </p>
      ))}
      {state.connection ? (
        <section className="card stack" style={{ gap: 10 }}>
          <TextArea label="Your message" hint="A suggestion. Make it yours." rows={4} max={2000} value={message} onChange={setText} />
          {error && <p className="note error" role="alert">{error}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy || !message.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await sendMessage(keys, state.connection!.id, state.partnerId, { text: message, kind: 'checkin' });
                await markDone(vibeId, 'checkin');
                navigate(`/connections/${state.connection!.id}/messages`);
              } catch (e) {
                setError(e instanceof AccountError ? e.message : "Ember couldn't send that. Please try again.");
                setBusy(false);
              }
            }}
          >
            Send and mark done
          </button>
        </section>
      ) : (
        <p className="card">You're not connected anymore, so there's no one to message.</p>
      )}
      <button
        type="button"
        className="btn btn-quiet btn-block"
        onClick={async () => {
          await markDone(vibeId, 'checkin');
          navigate('/');
        }}
      >
        I checked in another way
      </button>
    </Shell>
  );
}

// Home: what's due -------------------------------------------------------------------------

const dueTitle: Record<Reminder['kind'], (name: string) => string> = {
  post: () => 'How are you, right after?',
  debrief: () => 'Your debrief',
  followup: () => 'Your follow-up',
  checkin: (name) => `Check in with ${name}`,
  message: () => 'New message'
};

/** Due check-ins first, in amber (H1 and BH1). */
export function DueCheckIns({ word }: { word: string }) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [due, setDue] = useState<{ r: Reminder; name: string }[] | null>(null);
  useEffect(() => {
    if (!keys) return setDue([]);
    (async () => {
      const [all, conns, mine] = await Promise.all([listReminders(), listConnections(keys, cardFor(settings.identity)).catch(() => []), listScenes(keys).catch(() => [])]);
      const now = dueNow(all);
      const nameFor = (vibeId: string | null) => {
        const scene = mine.find((s) => s.share?.id === vibeId);
        const c = conns.find((x) => x.otherId === scene?.partnerId);
        return c ? displayName(c) : 'them';
      };
      setDue(now.map((r) => ({ r, name: nameFor(r.vibeId) })));
    })().catch(() => setDue([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  if (!keys) return null;
  if (due === null) return null;
  if (!due.length)
    return (
      <div className="card">
        <div className="eyebrow">Check-ins</div>
        <div className="card-title">Nothing due</div>
        <p className="setting-desc">Check-ins after a {word} show up here first.</p>
      </div>
    );
  return (
    <section className="card stack" style={{ gap: 8, borderLeft: '6px solid var(--saffron)' }} aria-label="Check-ins due">
      <div className="eyebrow">Check-ins due</div>
      {due.map(({ r, name }) => (
        <Link
          key={r.id}
          className="choice"
          style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}
          to={r.kind === 'followup' ? `/after/${r.vibeId}/followup/${r.day}` : r.kind === 'checkin' ? `/after/${r.vibeId}/checkin` : `/after/${r.vibeId}`}
        >
          <span className="choice-word">{dueTitle[r.kind](name)}</span>
          <span className="note">{r.kind === 'followup' ? `Day ${r.day}` : 'Open'} ›</span>
        </Link>
      ))}
    </section>
  );
}
