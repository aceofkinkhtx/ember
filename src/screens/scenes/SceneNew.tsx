import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ActivityList, ActivityTag, useAddActivity } from '../../components/scene/ActivityPicker';
import { MiniCurve, PhaseStrip, sceneFacts } from '../../components/scene/SceneCurve';
import { Segments, TextArea, TextInput } from '../../components/intake/Bits';
import { SettingSwitch } from '../../components/Switch';
import { shapes } from '../../content/sceneText';
import { phaseLabels } from '../../content/phases';
import { categories, markOptions } from '../../data/activities';
import type { Toy } from '../../lib/toys';
import { moved } from '../../components/scene/useReorder';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import { customDesign, designOptions, suggestedPicks, type DesignRequest } from '../../lib/scene/designer';
import type { Pick } from '../../lib/scene/model';
import { activityOf, blocks, validate, warnings } from '../../lib/scene/rules';
import { clearSceneDraft, loadSceneDraft, saveScene, saveSceneDraft } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { useSceneData, type SceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';

// S1 Scene basics, S2 Mutual actions and S4 Design options, one screen at a
// time. The setup is kept on this phone until a design is chosen.

type Step = 'basics' | 'picks' | 'options';

const MARK_ORDER = ['none', 'day', 'week', 'open'];

function blankRequest(): DesignRequest {
  return {
    title: '',
    connectionId: null,
    partnerId: null,
    partnerName: '',
    role: 'top',
    date: '',
    startTime: '',
    minutes: 90,
    location: '',
    isPublic: false,
    intense: false,
    intakeVersion: null,
    marks: 'none',
    useSpecificGear: false,
    gearIds: [],
    picks: [],
    overrides: [],
    notes: ''
  };
}

export function SceneNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const { keys, status } = useAccount();
  const [people, setPeople] = useState<Connection[] | null>(null);
  const [step, setStep] = useState<Step>('basics');
  const [req, setReq] = useState<DesignRequest>(() => {
    const draft = loadSceneDraft()?.request;
    const wanted = params.get('connection');
    // Gear is chosen inside each section now, not before the design.
    return draft && (!wanted || draft.connectionId === wanted) ? { ...draft, useSpecificGear: false, gearIds: [] } : { ...blankRequest(), connectionId: wanted };
  });
  const [picksReady, setPicksReady] = useState(req.picks.length > 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, showTheirGear } = useSceneData(req.connectionId, req.partnerId, req.role);

  useEffect(() => saveSceneDraft({ request: req }), [req]);
  useEffect(() => {
    document.querySelector('main.screen')?.scrollTo?.(0, 0);
  }, [step]);

  useEffect(() => {
    if (!keys) return;
    listConnections(keys, cardFor(settings.identity))
      .then((all) => setPeople(all.filter((c) => c.status === 'active')))
      .catch(() => setPeople([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  // Fill in the partner once the list arrives.
  useEffect(() => {
    if (!people || !req.connectionId || req.partnerId) return;
    const c = people.find((p) => p.id === req.connectionId);
    if (c) setReq((r) => ({ ...r, partnerId: c.otherId, partnerName: displayName(c), role: c.myRole === 'bottom' ? 'bottom' : r.role, title: r.title || `Scene with ${displayName(c)}` }));
  }, [people, req.connectionId, req.partnerId]);

  // Once their intake loads: the marks they agreed to, the version, and suggested picks.
  useEffect(() => {
    if (!data) return;
    setReq((r) => {
      const agreed = data.ctx.intakeOf === 'none' ? 'open' : (data.ctx.intake?.detailed?.impact.marks ?? 'none');
      const marks = MARK_ORDER.indexOf(r.marks) <= MARK_ORDER.indexOf(agreed) && r.intakeVersion === data.intakeVersion ? r.marks : agreed;
      return { ...r, intakeVersion: data.intakeVersion, marks };
    });
    if (!picksReady) {
      // Designing for a Top, picks start in the middle: their range applies when they accept.
      setReq((r) => ({ ...r, picks: suggestedPicks(data.ctx).map((p) => (r.role === 'bottom' ? { ...p, intensity: Math.min(p.intensity, 6) } : p)) }));
      setPicksReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (status !== 'signed-in') {
    return (
      <main className="screen">
        <h1>New scene</h1>
        <p className="card">Sign in to design scenes. Designs are locked on your phone before they're saved.</p>
      </main>
    );
  }

  const set = (patch: Partial<DesignRequest>) => setReq((r) => ({ ...r, ...patch }));

  async function choose(index: number) {
    if (!keys || !data) return;
    setBusy(true);
    setError('');
    try {
      const options = startingDesigns(req, data.ctx);
      const saved = await saveScene(keys, req.solo ? { ...options[index], inLibrary: true } : options[index]);
      clearSceneDraft();
      navigate(`/scenes/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't save this scene. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Scenes
      </Link>
      <div className="progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={['basics', 'picks', 'options'].indexOf(step) + 1} aria-label={`Step ${['basics', 'picks', 'options'].indexOf(step) + 1} of 3`}>
        <span style={{ width: `${((['basics', 'picks', 'options'].indexOf(step) + 1) / 3) * 100}%` }} />
      </div>

      {step === 'basics' && (
        <Basics
          req={req}
          set={set}
          people={people}
          data={data}
          onNext={() => setStep('picks')}
          onPerson={(c) => {
            setPicksReady(false);
            set({ solo: false, connectionId: c.id, partnerId: c.otherId, partnerName: displayName(c), role: c.myRole === 'bottom' ? 'bottom' : 'top', title: `Scene with ${displayName(c)}`, picks: [], overrides: [], gearIds: [] });
          }}
          onSolo={(role) => {
            setPicksReady(false);
            set({ solo: true, connectionId: null, partnerId: null, partnerName: '', role, title: req.title.startsWith('Scene with') || !req.title ? 'New scene' : req.title, picks: [], overrides: [], gearIds: [] });
          }}
          onRole={(role) => {
            setPicksReady(false);
            set({ role, picks: [], overrides: [] });
          }}
        />
      )}
      {step === 'picks' && data && <Picks req={req} set={set} ctx={data.ctx} gear={data.gear.filter((g) => !data.ctx.optedOutGear.includes(g.id))} onShowTheirGear={req.partnerId && !data.theirGearShown ? () => void showTheirGear() : undefined} onBack={() => setStep('basics')} onNext={() => setStep('options')} />}
      {step === 'options' && data && <Options req={req} data={data} busy={busy} onBack={() => setStep('picks')} onChoose={choose} />}
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

function Basics({
  req,
  set,
  people,
  data,
  onPerson,
  onSolo,
  onRole,
  onNext
}: {
  req: DesignRequest;
  set: (patch: Partial<DesignRequest>) => void;
  people: Connection[] | null;
  data: SceneData | null | undefined;
  onPerson: (c: Connection) => void;
  onSolo: (role: 'top' | 'bottom') => void;
  onRole: (role: 'top' | 'bottom') => void;
  onNext: () => void;
}) {
  const { settings } = useSettings();
  if (people === null) return <p className="note">Loading...</p>;
  const agreed = data?.ctx.intakeOf === 'none' ? 'open' : (data?.ctx.intake?.detailed?.impact.marks ?? 'none');
  const marks = markOptions.filter((m) => MARK_ORDER.indexOf(m.id) <= MARK_ORDER.indexOf(agreed));
  const pct = req.intense ? settings.top.settings.intensePercent : settings.top.settings.aftercarePercent;
  const hours = `${Math.floor(req.minutes / 60) ? `${Math.floor(req.minutes / 60)} h ` : ''}${req.minutes % 60 ? `${req.minutes % 60} min` : ''}`.trim();

  return (
    <>
      <h1>Scene basics</h1>
      <section className="card stack" style={{ gap: 14 }}>
        <label className="field">
          <span className="field-label">Who is this scene with?</span>
          <select
            className="input"
            value={req.solo ? 'solo' : (req.connectionId ?? '')}
            onChange={(e) => {
              if (e.target.value === 'solo') return onSolo(settings.roles === 'bottom' ? 'bottom' : settings.roles === 'top' ? 'top' : settings.activeRole);
              const c = people.find((p) => p.id === e.target.value);
              if (c) onPerson(c);
            }}
          >
            <option value="">Choose someone</option>
            <option value="solo">No one yet (save it to my library)</option>
            {people.map((c) => (
              <option key={c.id} value={c.id}>
                {displayName(c)}
              </option>
            ))}
          </select>
        </label>
        {req.solo && settings.roles === 'both' && (
          <Segments
            label="In this scene you are:"
            options={[
              { id: 'top', label: 'Top' },
              { id: 'bottom', label: 'bottom' }
            ]}
            value={req.role}
            onChange={onSolo}
          />
        )}
        {req.solo && data && (
          <p className="note" style={{ margin: 0 }}>
            {req.role === 'bottom'
              ? `Designing from your own intake${data.ctx.intake ? ` (version ${data.intakeVersion})` : ''}. It goes to your library; send it to a Top later with "Use with someone else".`
              : 'Designing from your offerings, with no one in mind yet. It goes to your library; use it with someone later and Ember checks it against their limits.'}
          </p>
        )}
        {!people.length && !req.solo && <p className="note" style={{ margin: 0 }}>No connections yet, so this design will be for your library.</p>}
        {req.connectionId && people.find((c) => c.id === req.connectionId)?.myRole === 'switch' && (
          <Segments
            label={`You and ${req.partnerName} are S/switches. In this scene you are:`}
            options={[
              { id: 'top', label: 'Top' },
              { id: 'bottom', label: 'bottom' }
            ]}
            value={req.role}
            onChange={onRole}
          />
        )}
        {req.connectionId && data === undefined && <p className="note">Loading the intake...</p>}
        {req.connectionId && data && (
          <p className="note" style={{ margin: 0 }}>
            {req.role === 'bottom'
              ? data.ctx.intake
                ? `Designing from your own intake (version ${data.intakeVersion}). ${req.partnerName} gets it as a request to accept and edit, with their own offerings and settings applied.`
                : 'Save your intake first (Profile), so the design knows what you said yes to.'
              : data.ctx.intake
                ? `Designing from ${req.partnerName}'s intake (version ${data.intakeVersion}). Ember only suggests what they said yes to.`
                : `${req.partnerName} hasn't shared an intake with you yet. You can still design, but every activity will be flagged "Discussed together?". Ask them to share from their profile.`}
          </p>
        )}
        <TextInput label="Name for this scene" value={req.title} max={60} onChange={(title) => set({ title })} />
      </section>

      <section className="card stack" style={{ gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span className="field-label">Date</span>
            <input className="input" type="date" value={req.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 120 }}>
            <span className="field-label">Start time</span>
            <input className="input" type="time" value={req.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">
            Play time: <strong>{hours}</strong>
          </span>
          <span className="field-hint">Aftercare comes after this: {pct}% of it{req.intense ? ', never under 30 minutes' : ''}.</span>
          <input type="range" min={20} max={480} step={5} value={req.minutes} aria-valuetext={hours} onChange={(e) => set({ minutes: Number(e.target.value) })} />
        </label>
        <TextInput label="Where (optional)" value={req.location} max={80} onChange={(location) => set({ location })} />
        <Segments
          label="Setting"
          options={[
            { id: 'private', label: 'Private' },
            { id: 'public', label: 'Public or party' }
          ]}
          value={req.isPublic ? 'public' : 'private'}
          onChange={(v) => set({ isPublic: v === 'public' })}
        />
        <SettingSwitch
          label="Intense scene"
          description={`Aftercare becomes ${settings.top.settings.intensePercent}% of play time, and never under 30 minutes.`}
          checked={req.intense}
          onChange={(intense) => set({ intense })}
        />
        {data && (
          <div className="stack" style={{ gap: 6 }}>
            <Segments label="Marks for this scene" options={marks} value={req.marks} onChange={(m) => set({ marks: m })} />
            <span className="note">{req.role === 'bottom' ? 'Up to what your intake says.' : `You can choose less than ${req.partnerName || 'they'} agreed to, never more.`}</span>
          </div>
        )}
      </section>

      <button type="button" className="btn btn-primary btn-block" disabled={(!req.connectionId && !req.solo) || !data || !req.title.trim()} onClick={onNext}>
        Continue
      </button>
    </>
  );
}

function Picks({
  req,
  set,
  ctx,
  gear,
  onShowTheirGear,
  onBack,
  onNext
}: {
  req: DesignRequest;
  set: (patch: Partial<DesignRequest>) => void;
  ctx: SceneData['ctx'];
  gear: Toy[];
  onShowTheirGear?: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const add = useAddActivity(ctx, (a, overrides) => {
    const range = ctx.top.offerings.categories[a.category];
    set({ picks: [...req.picks, { activityId: a.id, intensity: Math.min(range?.max ?? 6, 6), surprise: false }], overrides: [...req.overrides, ...overrides] });
  });
  const update = (id: string, patch: Partial<Pick>) => set({ picks: req.picks.map((p) => (p.activityId === id ? { ...p, ...patch } : p)) });
  const remove = (id: string) =>
    set({
      picks: req.picks.filter((p) => p.activityId !== id),
      overrides: req.overrides.filter((o) => o.activityId !== id),
      impactPlan: (req.impactPlan ?? []).filter((g) => g.activityId !== id)
    });
  const [open, setOpen] = useState<string | null>(null);
  const grouped = categories
    .map((c) => ({ c, picks: req.picks.filter((p) => activityOf(ctx, p.activityId)?.category === c.id) }))
    .filter((g) => g.picks.length > 0);

  return (
    <>
      <h1>What you'll do</h1>
      <p className="lede">
        {req.solo && req.role === 'top' ? 'Choose what this scene includes.' : req.role === 'bottom' ? 'Things you said yes to.' : `Things ${req.partnerName} said yes to and you offer.`} Set how far to take each one, or mark it as a surprise.
      </p>
      {req.picks.length === 0 && <p className="card">Nothing yet. Add activities below.</p>}
      <div className="stack" style={{ gap: 8 }}>
        {grouped.map(({ c, picks }) => (
          <div key={c.id} className="stack" style={{ gap: 8 }}>
            <button type="button" className="choice" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)} style={{ justifyContent: 'space-between' }}>
              <span className="choice-word">{c.label}</span>
              <span className="note">
                {picks.length} chosen {open === c.id ? '▴' : '▾'}
              </span>
            </button>
            {open === c.id && c.id === 'impact' && <GearPlan req={req} set={set} ctx={ctx} gear={gear} onShowTheirGear={onShowTheirGear} />}
            {open === c.id &&
              picks.map((p) => {
          const a = activityOf(ctx, p.activityId);
          if (!a) return null;
          return (
            <section key={p.activityId} className="card stack" style={{ gap: 8 }} aria-label={a.label}>
              <div className="person">
                <span style={{ fontWeight: 700, display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {a.label} <ActivityTag ctx={ctx} activity={a} />
                </span>
                <button type="button" className="btn btn-quiet" aria-label={`Remove ${a.label}`} onClick={() => remove(p.activityId)}>
                  Remove
                </button>
              </div>
              <label className="field">
                <span className="field-hint">
                  How far: <strong>{p.intensity}</strong> of 10
                </span>
                <input type="range" min={1} max={10} step={1} value={p.intensity} aria-label={`How far with ${a.label}`} onChange={(e) => update(p.activityId, { intensity: Number(e.target.value) })} />
              </label>
              <label className="check" style={{ minHeight: 0 }}>
                <input type="checkbox" checked={p.surprise} onChange={(e) => update(p.activityId, { surprise: e.target.checked })} />
                Surprise (their preview shows a surprise, not what it is)
              </label>
            </section>
          );
        })}
          </div>
        ))}
      </div>

      {adding ? (
        <section className="card stack" style={{ gap: 12 }} aria-label="Add more">
          <div className="person">
            <h2 style={{ margin: 0 }}>Add more</h2>
            <button type="button" className="btn btn-quiet" onClick={() => setAdding(false)}>
              Close
            </button>
          </div>
          {(ctx.intakeOf ?? 'partner') === 'partner' && (
          <p className="note" style={{ margin: 0 }}>
            Maybes and anything they didn't answer get an amber "Discussed together?" flag. A no needs their permission and your confirmation.
          </p>
          )}
          <ActivityList ctx={ctx} exclude={req.picks.map((p) => p.activityId)} onChoose={add.start} />
          {add.refused && (
            <p className="note error" role="alert">
              {add.refused}
            </p>
          )}
        </section>
      ) : (
        <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>
          Add more
        </button>
      )}
      {add.sheet}

      <section className="card">
        <TextArea
          label="Notes that shape the scene"
          hint="Surprises, unusual combinations, anything the design should know."
          value={req.notes}
          onChange={(notes) => set({ notes })}
        />
      </section>
      <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
        {req.picks.length ? 'See designs' : 'Build your own'}
      </button>
      {!req.picks.length && <p className="note" style={{ margin: 0, textAlign: 'center' }}>With nothing chosen, you start from empty sections.</p>}
      <button type="button" className="btn btn-quiet btn-block" onClick={onBack}>
        Back
      </button>
    </>
  );
}

function Options({
  req,
  data,
  busy,
  onBack,
  onChoose
}: {
  req: DesignRequest;
  data: SceneData;
  busy: boolean;
  onBack: () => void;
  onChoose: (index: number) => void;
}) {
  const options = useMemo(() => startingDesigns(req, data.ctx), [req, data.ctx]);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <h1>Pick a starting design</h1>
      <p className="lede">{options.length > 1 ? 'Each is a different shape, or build your own from empty sections. Everything stays editable.' : 'Start from empty sections and fill them with your own actions.'}</p>
      {options.map((scene, i) => {
        const issues = validate(scene, data.ctx);
        const warn = warnings(issues).length;
        return (
          <section key={scene.shape} className="card stack" style={{ gap: 10 }} aria-label={shapes[scene.shape].label}>
            <div className="person">
              <div>
                <div className="card-title">{shapes[scene.shape].label}</div>
                <div className="note">{sceneFacts(scene)}</div>
              </div>
              {i === 0 && data.ctx.intake?.quick?.words.flow.length ? <span className="tag tag-gray">{req.role === 'bottom' ? 'Fits your Flow' : 'Fits their Flow'}</span> : null}
            </div>
            <MiniCurve scene={scene} />
            <PhaseStrip scene={scene} />
            <p className="setting-desc" style={{ margin: 0 }}>
              {shapes[scene.shape].desc}
            </p>
            {(warn > 0 || blocks(issues).length > 0) && (
              <p className="note" style={{ margin: 0 }}>
                {warn} {warn === 1 ? 'thing' : 'things'} to look at in the editor.
              </p>
            )}
            {open === i && (
              <ol className="stack" style={{ gap: 4, margin: 0, paddingLeft: 20 }}>
                {scene.phases.map((p) => (
                  <li key={p.id}>
                    <strong>{phaseLabels[p.type]}</strong>: {p.beats.map((b) => `${b.title} (${b.minutes} min, intensity ${b.intensity})`).join(', ')}
                  </li>
                ))}
              </ol>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onChoose(i)}>
                Use this one
              </button>
              <button type="button" className="btn btn-quiet" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? 'Hide preview' : 'Preview'}
              </button>
            </div>
          </section>
        );
      })}
      <button type="button" className="btn btn-quiet btn-block" onClick={onBack}>
        Back
      </button>
    </>
  );
}

/** The starting designs (when there are picks to place), then Build your own. */
function startingDesigns(req: DesignRequest, ctx: SceneData['ctx']) {
  return [...(req.picks.length ? designOptions(req, ctx) : []), customDesign(req, ctx)];
}

/** Guesses which impact pick a piece of gear is, from its name. */
function guessActivity(name: string, impactIds: string[]): string {
  const n = name.toLowerCase();
  const hints: [RegExp, string][] = [
    [/glove/, 'gloved-hand'],
    [/hand/, 'bare-hand'],
    [/paddle|strap|spoon|brush/, 'paddle'],
    [/flog/, 'flogger'],
    [/cane|rattan|switch/, 'cane'],
    [/whip|single tail|crop/, 'whip']
  ];
  return hints.find(([re, id]) => re.test(n) && impactIds.includes(id))?.[1] ?? impactIds[0];
}

/**
 * The impact gear plan: pieces in the order you want to use them, each as one
 * of your impact picks. Ember builds the impact progression from this order,
 * warm-up through the peaks.
 */
function GearPlan({ req, set, ctx, gear, onShowTheirGear }: { req: DesignRequest; set: (patch: Partial<DesignRequest>) => void; ctx: SceneData['ctx']; gear: Toy[]; onShowTheirGear?: () => void }) {
  const { keys } = useAccount();
  const impactPicks = req.picks.map((p) => activityOf(ctx, p.activityId)).filter((a) => a?.category === 'impact') as NonNullable<ReturnType<typeof activityOf>>[];
  const plan = req.impactPlan ?? [];
  const impactGear = gear.filter((g) => g.types.includes('impact'));
  const setPlan = (impactPlan: typeof plan) => set({ impactPlan });
  const nameOf = (id: string) => {
    const g = gear.find((x) => x.id === id);
    return g ? `${g.name}${g.ownerId !== keys?.userId ? ' (theirs)' : ''}` : 'Gear';
  };

  return (
    <section className="card stack" style={{ gap: 10 }} aria-label="Gear, in order">
      <div className="card-title">Gear, in order</div>
      <p className="setting-desc" style={{ margin: 0 }}>
        Plan the progression: list your impact gear in the order you want to use it. Ember spreads it from the warm-up to the peaks. You can also add gear to any section later, in the editor.
      </p>
      {onShowTheirGear && (
        <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={onShowTheirGear}>
          Show {req.partnerName}'s gear too
        </button>
      )}
      {!impactPicks.length ? (
        <p className="note" style={{ margin: 0 }}>Add an impact activity first, so each piece has something to be.</p>
      ) : !impactGear.length ? (
        <p className="note" style={{ margin: 0 }}>
          Add impact gear in the Gear tab to plan it here.
        </p>
      ) : (
        <>
          <ol className="stack" style={{ gap: 8, margin: 0, paddingLeft: 20 }}>
            {plan.map((step, i) => (
              <li key={`${step.gearId}-${i}`}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ flex: '1 1 120px' }}>{nameOf(step.gearId)}</strong>
                  <select
                    className="input"
                    aria-label={`${nameOf(step.gearId)} is used as`}
                    value={step.activityId}
                    onChange={(e) => setPlan(plan.map((x, k) => (k === i ? { ...x, activityId: e.target.value } : x)))}
                    style={{ flex: '1 1 140px', minHeight: 40, padding: '6px 10px' }}
                  >
                    {impactPicks.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-quiet" aria-label={`Move ${nameOf(step.gearId)} earlier`} disabled={i === 0} onClick={() => setPlan(moved(plan, i, i - 1))}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-quiet" aria-label={`Move ${nameOf(step.gearId)} later`} disabled={i === plan.length - 1} onClick={() => setPlan(moved(plan, i, i + 1))}>
                    ↓
                  </button>
                  <button type="button" className="btn btn-quiet" aria-label={`Remove ${nameOf(step.gearId)}`} onClick={() => setPlan(plan.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <select
            className="input"
            aria-label="Add gear to the plan"
            value=""
            onChange={(e) => {
              const g = impactGear.find((x) => x.id === e.target.value);
              if (g) setPlan([...plan, { gearId: g.id, activityId: guessActivity(g.name, impactPicks.map((a) => a.id)) }]);
            }}
          >
            <option value="">{plan.length ? 'Add the next piece' : 'Add the first piece'}</option>
            {impactGear.map((g) => (
              <option key={g.id} value={g.id}>
                {nameOf(g.id)}
              </option>
            ))}
          </select>
        </>
      )}
    </section>
  );
}
