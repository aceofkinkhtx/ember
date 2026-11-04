import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BeatSheet, StepSheet } from '../../components/scene/EditSheets';
import { MiniCurve, PhaseStrip, sceneFacts, usePhaseColor } from '../../components/scene/SceneCurve';
import { moved, useReorder } from '../../components/scene/useReorder';
import { LimitStrip } from '../../components/intake/IntakeSummary';
import { SettingSwitch } from '../../components/Switch';
import { phaseLabels, type PhaseType } from '../../content/phases';
import { fixed, shapes } from '../../content/sceneText';
import { AccountError } from '../../lib/account';
import { newBeat, newId, newStep, phaseMinutes, type Beat, type Override, type Phase, type Scene, type Step } from '../../lib/scene/model';
import { activityOf, automaticFlags, blocks, needsNextMorningCheckIn, tryChange, validate, warnings, type Issue, type RuleContext } from '../../lib/scene/rules';
import { copyScene, deleteScene, listScenes, saveScene } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { useSceneData } from '../../state/sceneContext';

// S5: the scene editor. Phases are collapsible color bands, beats are cards
// inside them, steps sit inside beats; every level has a drag handle. Every
// edit goes through the rules: a change that breaks a block rule is refused
// with a one-line reason, and warnings show inline in amber.

type Editing = { kind: 'beat'; phaseId: string; beatId: string } | { kind: 'step'; beatId: string; stepId: string } | null;

export function SceneEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { keys } = useAccount();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const data = useSceneData(scene?.connectionId ?? null, scene?.partnerId ?? null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!keys) return;
    listScenes(keys)
      .then((all) => setScene(all.find((s) => s.id === id) ?? null))
      .catch(() => setScene(null));
  }, [keys, id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (scene === undefined || (scene && data === undefined)) {
    return (
      <main className="screen">
        <p className="note">Loading...</p>
      </main>
    );
  }
  if (!scene || !data) {
    return (
      <main className="screen">
        <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Scenes
        </Link>
        <p className="card">That scene isn't available.</p>
      </main>
    );
  }
  const ctx = data.ctx;
  const current: Scene = scene;

  function persist(next: Scene) {
    if (!keys) return;
    setSaved('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveScene(keys, next)
        .then(() => setSaved('saved'))
        .catch(() => setSaved('error'));
    }, 600);
  }

  /** Applies an edit if the rules allow it; returns the reason if not. */
  function apply(next: Scene): string | null {
    const result = tryChange(current, next, ctx);
    if (!result.ok) {
      setToast(result.reason);
      return result.reason;
    }
    // The next-morning check-in turns on by itself when the scene needs it.
    const fixedUp = needsNextMorningCheckIn(next, ctx) ? { ...next, nextMorningCheckIn: true } : next;
    setScene(fixedUp);
    persist(fixedUp);
    return null;
  }

  const mapPhases = (fn: (p: Phase) => Phase) => ({ ...current, phases: current.phases.map(fn) });
  const beatById = (beatId: string) => current.phases.flatMap((p) => p.beats).find((b) => b.id === beatId);

  function saveBeat(phaseId: string, beat: Beat, toPhase: string): string | null {
    if (toPhase === phaseId) return apply(mapPhases((p) => (p.id === phaseId ? { ...p, beats: p.beats.map((b) => (b.id === beat.id ? beat : b)) } : p)));
    return apply(
      mapPhases((p) => {
        if (p.id === phaseId) return { ...p, beats: p.beats.filter((b) => b.id !== beat.id) };
        if (p.id === toPhase) return { ...p, beats: [...p.beats, beat] };
        return p;
      })
    );
  }

  function saveStep(beatId: string, step: Step, overrides: Override[]): string | null {
    const next = mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beatId ? { ...b, steps: b.steps.map((s) => (s.id === step.id ? step : s)) } : b)) }));
    return apply({ ...next, overrides: [...current.overrides, ...overrides] });
  }

  function addPhase(type: PhaseType) {
    const beat =
      type === 'recovery'
        ? newBeat({ kind: 'recovery', title: fixed.recovery.title, minutes: 5, intensity: 2, steps: [newStep({ do: fixed.recovery.do, say: fixed.recovery.say })] })
        : type === 'ritual'
          ? newBeat({ kind: 'ritual', title: 'Opening ritual', minutes: 5, intensity: 2, steps: [newStep({ do: 'Posture, clothing and objects.', say: 'The words you say together.' })] })
          : newBeat({ title: phaseLabels[type], minutes: 10, intensity: type === 'peak' ? 6 : 4, steps: [newStep()] });
    const phase: Phase = { id: newId('p'), type, beats: [beat] };
    // New phases go before the descent; a ritual goes right after arrival.
    const at = type === 'ritual' ? 1 : Math.max(1, current.phases.findIndex((p) => p.type === 'descent'));
    const phases = [...current.phases];
    phases.splice(at < 0 ? phases.length - 1 : at, 0, phase);
    apply({ ...current, phases });
  }

  const issues = validate(scene, ctx);
  const auto = automaticFlags(scene, ctx);
  const editingBeat = editing?.kind === 'beat' ? beatById(editing.beatId) : undefined;
  const editingStep = editing?.kind === 'step' ? beatById(editing.beatId)?.steps.find((s) => s.id === editing.stepId) : undefined;

  return (
    <main className="screen">
      <div className="person">
        <Link to="/scenes" className="btn btn-quiet">
          ‹ Scenes
        </Link>
        <span className="note" aria-live="polite">
          {saved === 'saving' ? 'Saving...' : saved === 'error' ? "Couldn't save. Check your connection." : 'Saved'}
        </span>
      </div>
      <div>
        <h1 style={{ marginBottom: 4 }}>{scene.title}</h1>
        <p className="note" style={{ margin: 0 }}>
          {scene.partnerName ? `With ${scene.partnerName}. ` : ''}
          {shapes[scene.shape].label}, {sceneFacts(scene)}
          {scene.intense ? ', intense' : ''}.
        </p>
      </div>
      <MiniCurve scene={scene} />
      <PhaseStrip scene={scene} />
      {ctx.intake && <LimitStrip intake={ctx.intake} />}

      <IssueList scene={scene} issues={issues} onKeep={(key, reason) => apply({ ...scene, kept: { ...scene.kept, [key]: { reason, at: new Date().toISOString() } } })} />

      <Phases
        scene={scene}
        ctx={ctx}
        issues={issues}
        auto={auto}
        onApply={apply}
        onEditBeat={(phaseId, beatId) => setEditing({ kind: 'beat', phaseId, beatId })}
        onEditStep={(beatId, stepId) => setEditing({ kind: 'step', beatId, stepId })}
      />

      <section className="card stack" style={{ gap: 10 }} aria-label="Add a phase">
        <span className="field-label" style={{ fontSize: 16 }}>
          Add to the arc
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => addPhase('ritual')}>
            Ritual
          </button>
          <button type="button" className="btn btn-outline" onClick={() => addPhase('build')}>
            Build
          </button>
          <button type="button" className="btn btn-outline" onClick={() => addPhase('recovery')}>
            Recovery
          </button>
          <button type="button" className="btn btn-outline" onClick={() => addPhase('peak')}>
            Peak
          </button>
        </div>
        <p className="note" style={{ margin: 0 }}>
          Aftercare always stays last.
        </p>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <SettingSwitch
          label="Next-morning check-in"
          description={needsNextMorningCheckIn(scene, ctx) ? 'Required: this scene may reach subspace or release.' : 'A check-in with them the morning after.'}
          checked={scene.nextMorningCheckIn}
          onChange={(on) => apply({ ...scene, nextMorningCheckIn: on })}
        />
        <SettingSwitch label="Keep in my library" description="Saved designs can be reused and changed." checked={scene.inLibrary} onChange={(inLibrary) => apply({ ...scene, inLibrary })} />
      </section>

      <Record scene={scene} ctx={ctx} />

      <div className="stack" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-block" disabled>
          Share SceneVibe (arrives in the next update)
        </button>
        <button
          type="button"
          className="btn btn-outline btn-block"
          onClick={() => {
            if (!keys) return;
            const copy = copyScene(scene);
            saveScene(keys, copy)
              .then((s) => navigate(`/scenes/${s.id}`))
              .catch(() => setToast("Ember couldn't copy this scene."));
          }}
        >
          Duplicate
        </button>
        <button type="button" className="btn btn-quiet btn-block" onClick={() => setConfirmDelete(true)}>
          Delete scene
        </button>
      </div>

      {editing?.kind === 'beat' && editingBeat && (
        <BeatSheet
          beat={editingBeat}
          phaseId={editing.phaseId}
          phases={scene.phases}
          automatic={auto.get(editingBeat.id) ?? []}
          onSave={(b, to) => saveBeat(editing.phaseId, b, to)}
          onDelete={() => apply(mapPhases((p) => ({ ...p, beats: p.beats.filter((b) => b.id !== editingBeat.id) })))}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'step' && editingStep && (
        <StepSheet
          step={editingStep}
          ctx={ctx}
          gear={data.gear}
          onSave={(s, o) => saveStep(editing.beatId, s, o)}
          onDelete={() => apply(mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === editing.beatId ? { ...b, steps: b.steps.filter((s) => s.id !== editingStep.id) } : b)) })))}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDelete && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="scene-delete-title">
          <div className="sheet">
            <h2 id="scene-delete-title">Delete {scene.title}?</h2>
            <p>The design and its record are removed. This can't be undone.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() =>
                deleteScene(scene.id)
                  .then(() => navigate('/scenes', { replace: true }))
                  .catch((err) => setToast(err instanceof AccountError ? err.message : "Ember couldn't delete this scene."))
              }
            >
              Delete
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="alert">
          {toast}
        </div>
      )}
    </main>
  );
}

function IssueList({ scene, issues, onKeep }: { scene: Scene; issues: Issue[]; onKeep: (key: string, reason: string) => void }) {
  const [keeping, setKeeping] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const open = [...blocks(issues), ...warnings(issues).filter((w) => !w.kept)];
  if (!open.length) return null;
  return (
    <section className="stack" style={{ gap: 6 }} aria-label="Things to look at">
      {open.map((i) => (
        <div key={i.key} className={`box ${i.level === 'block' ? 'box-block' : 'box-warn'}`}>
          {i.message}
          {i.level === 'warn' && (
            <KeepControl id={i.key} keeping={keeping} reason={reason} setKeeping={setKeeping} setReason={setReason} onKeep={onKeep} />
          )}
        </div>
      ))}
      {scene.phases.length === 0 && <p className="note">This design is empty.</p>}
    </section>
  );
}

function KeepControl({
  id,
  keeping,
  reason,
  setKeeping,
  setReason,
  onKeep
}: {
  id: string;
  keeping: string | null;
  reason: string;
  setKeeping: (k: string | null) => void;
  setReason: (r: string) => void;
  onKeep: (key: string, reason: string) => void;
}) {
  if (keeping !== id) {
    return (
      <button type="button" className="btn btn-quiet" style={{ minHeight: 32, padding: '2px 6px', marginLeft: 6 }} onClick={() => { setKeeping(id); setReason(''); }}>
        Keep anyway
      </button>
    );
  }
  return (
    <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <input className="input" aria-label="Your reason" placeholder="Your reason" maxLength={160} value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, minHeight: 40, padding: '6px 10px' }} />
      <button type="button" className="btn btn-secondary" disabled={!reason.trim()} onClick={() => { onKeep(id, reason.trim()); setKeeping(null); }}>
        Keep
      </button>
    </span>
  );
}

function Phases({
  scene,
  ctx,
  issues,
  auto,
  onApply,
  onEditBeat,
  onEditStep
}: {
  scene: Scene;
  ctx: RuleContext;
  issues: Issue[];
  auto: Map<string, { kind: string; text: string }[]>;
  onApply: (next: Scene) => string | null;
  onEditBeat: (phaseId: string, beatId: string) => void;
  onEditStep: (beatId: string, stepId: string) => void;
}) {
  const colorOf = usePhaseColor();
  const reorder = useReorder(scene.phases.length, (from, to) => onApply({ ...scene, phases: moved(scene.phases, from, to) }));
  return (
    <div className="stack" style={{ gap: 12 }}>
      {scene.phases.map((phase, i) => {
        const color = colorOf(scene, phase);
        const item = reorder.item(i);
        return (
          <details key={phase.id} open ref={item.ref} className={item.className} style={{ ...item.style, borderRadius: 16, background: 'var(--surface)', border: `2px solid ${color}` }}>
            <summary style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', background: color, color: '#fff', borderRadius: '12px 12px 0 0', cursor: 'pointer' }}>
              <button type="button" className="drag-handle" style={{ color: '#fff' }} {...reorder.handle(i, `${phaseLabels[phase.type]} phase`)}>
                ⠿
              </button>
              <strong style={{ flex: 1 }}>{phaseLabels[phase.type]}</strong>
              <span>{phaseMinutes(phase)} min</span>
            </summary>
            <Beats scene={scene} phase={phase} ctx={ctx} issues={issues} auto={auto} onApply={onApply} onEditBeat={onEditBeat} onEditStep={onEditStep} />
          </details>
        );
      })}
    </div>
  );
}

function Beats({
  scene,
  phase,
  ctx,
  issues,
  auto,
  onApply,
  onEditBeat,
  onEditStep
}: {
  scene: Scene;
  phase: Phase;
  ctx: RuleContext;
  issues: Issue[];
  auto: Map<string, { kind: string; text: string }[]>;
  onApply: (next: Scene) => string | null;
  onEditBeat: (phaseId: string, beatId: string) => void;
  onEditStep: (beatId: string, stepId: string) => void;
}) {
  const withBeats = (beats: Beat[]) => ({ ...scene, phases: scene.phases.map((p) => (p.id === phase.id ? { ...p, beats } : p)) });
  const reorder = useReorder(phase.beats.length, (from, to) => onApply(withBeats(moved(phase.beats, from, to))));
  return (
    <div className="stack" style={{ gap: 10, padding: 10 }}>
      {phase.beats.map((beat, i) => {
        const item = reorder.item(i);
        const mine = issues.filter((x) => x.beatId === beat.id && !(x.level === 'warn' && x.kept));
        return (
          <article
            key={beat.id}
            ref={item.ref}
            className={['card', 'stack', item.className].filter(Boolean).join(' ')}
            style={{ ...item.style, gap: 8, padding: 12 }}
            aria-label={beat.title || 'Beat'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" className="drag-handle" {...reorder.handle(i, beat.title || 'beat')}>
                ⠿
              </button>
              <button type="button" onClick={() => onEditBeat(phase.id, beat.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, minHeight: 'var(--touch)', cursor: 'pointer' }}>
                <span style={{ fontWeight: 700, display: 'block' }}>{beat.title || 'Untitled beat'}</span>
                <span className="note">
                  {beat.minutes} min, intensity {beat.intensity}
                  {beat.areas.length ? `, ${beat.areas.length} ${beat.areas.length === 1 ? 'area' : 'areas'}` : ''}
                </span>
              </button>
            </div>
            {mine.map((x) => (
              <p key={x.key} className={`box ${x.level === 'block' ? 'box-block' : 'box-warn'}`}>
                {x.message}
              </p>
            ))}
            {(auto.get(beat.id) ?? []).filter((f) => f.kind === 'warning').map((f, k) => (
              <p key={`a${k}`} className="box box-warning">
                {f.text}
              </p>
            ))}
            {beat.flags.map((f, k) => (
              <p key={`f${k}`} className={`box box-${f.kind}`}>
                {f.text}
              </p>
            ))}
            <Steps scene={scene} beat={beat} ctx={ctx} onApply={onApply} onEditStep={onEditStep} />
          </article>
        );
      })}
      <button
        type="button"
        className="btn btn-quiet"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onApply(withBeats([...phase.beats, newBeat({ title: 'New beat', intensity: Math.min(4, phase.beats.at(-1)?.intensity ?? 3), steps: [newStep()] })]))}
      >
        + Add beat
      </button>
    </div>
  );
}

function Steps({
  scene,
  beat,
  ctx,
  onApply,
  onEditStep
}: {
  scene: Scene;
  beat: Beat;
  ctx: RuleContext;
  onApply: (next: Scene) => string | null;
  onEditStep: (beatId: string, stepId: string) => void;
}) {
  const withSteps = (steps: Step[]) => ({ ...scene, phases: scene.phases.map((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beat.id ? { ...b, steps } : b)) })) });
  const reorder = useReorder(beat.steps.length, (from, to) => onApply(withSteps(moved(beat.steps, from, to))));
  const label = (s: Step) => activityOf(ctx, s.activityId)?.label ?? (s.do.split('.')[0] || 'Step');
  return (
    <ol className="stack" style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
      {beat.steps.map((s, i) => {
        const item = reorder.item(i);
        return (
          <li key={s.id} ref={item.ref} className={item.className} style={{ ...item.style, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--ground)', borderRadius: 10 }}>
            <button type="button" className="drag-handle" {...reorder.handle(i, label(s))}>
              ⠿
            </button>
            <button type="button" onClick={() => onEditStep(beat.id, s.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: '6px 0', minHeight: 'var(--touch)', cursor: 'pointer' }}>
              <span style={{ display: 'block', fontWeight: 600 }}>
                {label(s)}
                {s.surprise ? ' (surprise)' : ''}
              </span>
              {s.say && <span className="note">SAY: {s.say}</span>}
            </button>
          </li>
        );
      })}
      <li>
        <button type="button" className="btn btn-quiet" onClick={() => onApply(withSteps([...beat.steps, newStep()]))}>
          + Add step
        </button>
      </li>
    </ol>
  );
}

function Record({ scene, ctx }: { scene: Scene; ctx: RuleContext }) {
  const entries = [
    ...scene.overrides.map((o) => ({
      at: o.confirmedAt,
      text: `${activityOf(ctx, o.activityId)?.label ?? o.activityId}: ${o.kind === 'no' ? 'they said no; you confirmed you talked and agreed' : o.kind === 'edge' ? 'edge play, negotiation confirmed' : 'negotiated for this scene'}`
    })),
    ...Object.entries(scene.kept).map(([key, k]) => ({ at: k.at, text: `Kept a warning (${key.split(':')[0]}): ${k.reason}` }))
  ].sort((a, b) => a.at.localeCompare(b.at));
  if (!entries.length) return null;
  return (
    <section className="card stack" style={{ gap: 6 }} aria-label="Record">
      <div className="eyebrow">Record</div>
      <p className="note" style={{ margin: 0 }}>
        Every override and kept warning, dated. Designed from intake version {scene.intakeVersion ?? 'none'}.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {entries.map((e, i) => (
          <li key={i}>
            {new Date(e.at).toLocaleDateString()}: {e.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
