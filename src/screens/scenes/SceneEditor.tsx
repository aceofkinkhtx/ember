import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AddActivitySheet, BeatSheet, GearSheet, MinutesSheet, SetupSheet, StepSheet } from '../../components/scene/EditSheets';
import { setupLabel } from '../../data/positions';
import { moveStep, placeBeat, placeStep, playMinutes, setPhaseMinutes, setPlayMinutes, withAftercareFit } from '../../lib/scene/timing';
import { MiniCurve, PhaseStrip, sceneFacts, usePhaseColor } from '../../components/scene/SceneCurve';
import { RequestCard, ReuseSheet } from '../../components/scene/SceneActions';
import { moved, useReorder } from '../../components/scene/useReorder';
import { useMoveDrag, type DropAt } from '../../components/scene/useMoveDrag';
import { LimitStrip } from '../../components/intake/IntakeSummary';
import { IntakeReminder } from '../../components/IntakeReminder';
import { SettingSwitch } from '../../components/Switch';
import { momentName, phaseLabels, type PhaseType } from '../../content/phases';
import { fixed, shapes } from '../../content/sceneText';
import { AccountError } from '../../lib/account';
import { newBeat, newId, newStep, phaseMinutes, type Beat, type Override, type Phase, type Scene, type Step } from '../../lib/scene/model';
import { AFTERCARE_RULES, activityOf, automaticFlags, openContext, withAgreed, blocks, needsNextMorningCheckIn, tryChange, validate, warnings, type Issue, type RuleContext } from '../../lib/scene/rules';
import { copyScene, deleteScene, listScenes, saveScene } from '../../lib/scenes';
import { shareVibe } from '../../lib/vibes';
import { useSettings } from '../../state/settings';
import { useAccount } from '../../state/account';
import { useSceneData } from '../../state/sceneContext';

// S5: the scene editor. Phases are collapsible color bands, beats are cards
// inside them, steps sit inside beats; every level has a drag handle. On
// screen, phases and beats are both "moments" and steps are "activities"
// (Michael, Nov 25). Every
// edit goes through the rules: a change that breaks a block rule is refused
// with a one-line reason, and warnings show inline in amber. Steps drag into
// any beat and beats into any section. When an edit makes play longer,
// aftercare grows to match and a note says by how much.

type Editing =
  | { kind: 'beat'; phaseId: string; beatId: string }
  | { kind: 'step'; beatId: string; stepId: string }
  | { kind: 'gear'; beatId: string }
  | { kind: 'add-activity'; beatId: string }
  | { kind: 'phase-time'; phaseId: string }
  | { kind: 'phase-setup'; phaseId: string }
  | { kind: 'play-time' }
  | null;

export function SceneEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState<{ text: string; info?: boolean } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState<{ phaseId: string; beatId?: string } | null>(null);
  const [reusing, setReusing] = useState(false);
  const changes = (useLocation().state as { changes?: string[] } | null)?.changes ?? [];
  const { data, showTheirGear } = useSceneData(scene?.connectionId ?? null, scene?.partnerId ?? null, scene?.role ?? 'top');
  const timer = useRef<number | undefined>(undefined);
  // Drops land through the latest scene, set once it has loaded.
  const drop = useRef<{ beat: (id: string, to: DropAt) => void; step: (id: string, to: DropAt) => void }>({ beat: () => {}, step: () => {} });
  const beatDrag = useMoveDrag('beat', (id, to) => drop.current.beat(id, to));
  const stepDrag = useMoveDrag('step', (id, to) => drop.current.step(id, to));

  useEffect(() => {
    if (!keys) return;
    listScenes(keys)
      .then((all) => setScene(all.find((s) => s.id === id) ?? null))
      .catch(() => setScene(null));
  }, [keys, id]);

  // Gear from the partner's collection shows by name once their shared gear is loaded.
  const usesTheirGear = Boolean(scene && data && !data.theirGearShown && scene.phases.some((p) => p.beats.some((b) => b.steps.some((st) => st.gearId && !data.gear.some((g) => g.id === st.gearId)))));
  useEffect(() => {
    if (usesTheirGear) void showTheirGear();
  }, [usesTheirGear, showTheirGear]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
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
  const ctx = withAgreed(scene.noRoles ? openContext(data.ctx) : data.ctx, scene.agreed);
  const current: Scene = scene;

  function persist(next: Scene) {
    if (!keys) return;
    setSaved('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveScene(keys, next)
        // A shared SceneVibe follows the design.
        .then((s) => (s.share ? shareVibe(keys, s, settings.top.settings.phaseColors) : s))
        .then(() => setSaved('saved'))
        .catch(() => setSaved('error'));
    }, 600);
  }

  /**
   * Applies an edit if the rules allow it; returns the reason if not. `force`
   * is only for deleting a moment after its warning is ticked: the rule's red
   * item then stays, and the scene can't be started or sent until it's fixed.
   * Nothing sets aside the aftercare rules.
   */
  function apply(edit: Scene, force = false): string | null {
    const { scene: next, grewBy } = withAftercareFit(current, edit, ctx.top.settings);
    const result = tryChange(current, next, ctx);
    const had = new Set(blocks(validate(current, ctx)).map((i) => i.key));
    const aftercareHit = blocks(validate(next, ctx)).find((i) => AFTERCARE_RULES.includes(i.rule) && !had.has(i.key));
    if (force && aftercareHit) {
      setToast({ text: aftercareHit.message });
      return aftercareHit.message;
    }
    if (!result.ok && !force) {
      setToast({ text: result.reason });
      return result.reason;
    }
    // The next-morning check-in turns on by itself when the scene needs it.
    const fixedUp = needsNextMorningCheckIn(next, ctx) ? { ...next, nextMorningCheckIn: true } : next;
    setScene(fixedUp);
    persist(fixedUp);
    if (grewBy > 0) setToast({ text: `Aftercare extended by ${grewBy} min to match the longer scene.`, info: true });
    return null;
  }

  drop.current = {
    beat: (beatId, to) => apply(placeBeat(current, beatId, to.container, to.index)),
    step: (stepId, to) => apply(placeStep(current, stepId, to.container, to.index))
  };

  const mapPhases = (fn: (p: Phase) => Phase) => ({ ...current, phases: current.phases.map(fn) });
  const beatById = (beatId: string) => current.phases.flatMap((p) => p.beats).find((b) => b.id === beatId);

  function withBeat(phaseId: string, beat: Beat, toPhase: string): Scene {
    if (toPhase === phaseId) return mapPhases((p) => (p.id === phaseId ? { ...p, beats: p.beats.map((b) => (b.id === beat.id ? beat : b)) } : p));
    return mapPhases((p) => {
      if (p.id === phaseId) return { ...p, beats: p.beats.filter((b) => b.id !== beat.id) };
      if (p.id === toPhase) return { ...p, beats: [...p.beats, beat] };
      return p;
    });
  }

  /** What an edit would look like, aftercare included, for the live map. */
  const preview = (edit: Scene) => withAftercareFit(current, edit, ctx.top.settings).scene;

  function saveStep(beatId: string, step: Step, overrides: Override[], toBeatId: string): string | null {
    const next = mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beatId ? { ...b, steps: b.steps.map((s) => (s.id === step.id ? step : s)) } : b)) }));
    const placed = toBeatId === beatId ? next : moveStep(next, step, toBeatId);
    return apply({ ...placed, overrides: [...current.overrides, ...overrides] });
  }

  function addPhase(type: PhaseType) {
    if (type === 'aftercare' || type === 'arrival' || type === 'descent' || type === 'close') return putBack(type);
    const beat =
      type === 'recovery'
        ? newBeat({ kind: 'recovery', title: fixed.recovery.title, minutes: 5, intensity: 2, steps: [newStep({ do: fixed.recovery.do, say: fixed.recovery.say })] })
        : type === 'ritual'
          ? newBeat({ kind: 'ritual', title: 'Opening ritual', minutes: 5, intensity: 2, steps: [newStep({ do: 'Posture, clothing and objects.', say: 'The words you say together.' })] })
          : newBeat({ title: phaseLabels[type], minutes: 10, intensity: type === 'peak' ? 6 : 4 });
    const phase: Phase = { id: newId('p'), type, beats: [beat] };
    // New moments go before the descent; a ritual goes right after arrival.
    const at = type === 'ritual' ? 1 : Math.max(1, current.phases.findIndex((p) => p.type === 'descent'));
    const phases = [...current.phases];
    phases.splice(at < 0 ? phases.length - 1 : at, 0, phase);
    apply({ ...current, phases });
  }

  /** Puts a required section back where it belongs, after it was deleted. */
  function putBack(type: 'arrival' | 'descent' | 'close' | 'aftercare') {
    const phases = [...current.phases];
    const idx = (t: PhaseType) => phases.findIndex((p) => p.type === t);
    const end = () => (idx('aftercare') >= 0 ? idx('aftercare') : phases.length);
    if (type === 'arrival') {
      phases.unshift({ id: newId('p'), type, beats: [newBeat({ title: fixed.arrival.title, minutes: 5, intensity: 2, steps: [newStep({ do: fixed.arrival.do, say: fixed.arrival.say })] })] });
    } else if (type === 'descent') {
      const at = idx('close') >= 0 ? idx('close') : end();
      phases.splice(at, 0, { id: newId('p'), type, beats: [newBeat({ kind: 'landing', title: fixed.descent.title, minutes: 5, intensity: 3, steps: [newStep({ do: fixed.descent.do, say: fixed.descent.say })] })] });
    } else if (type === 'close') {
      phases.splice(end(), 0, {
        id: newId('p'),
        type,
        beats: [newBeat({ kind: 'named', title: fixed.close.title, minutes: 3, intensity: 1, steps: [newStep({ do: fixed.close.do, say: fixed.close.say, notes: fixed.close.notes })] })]
      });
    } else {
      // Aftercare grows to the Top's setting once it's back.
      phases.push({
        id: newId('p'),
        type,
        beats: [
          newBeat({ kind: 'immediate', title: fixed.immediate.title, minutes: 5, intensity: 1, steps: [newStep({ do: fixed.immediate.do })] }),
          newBeat({ kind: 'settled', title: fixed.settled.title, minutes: 5, intensity: 1, steps: [newStep({ do: fixed.settled.do })] }),
          newBeat({ kind: 'closing', title: fixed.closing.title, minutes: 2, intensity: 1, steps: [newStep({ do: fixed.closing.do, say: fixed.closing.say })] })
        ]
      });
    }
    apply({ ...current, phases });
  }

  // While a beat is dragged, the map shows where it would land.
  const shown = beatDrag.dragging ? preview(placeBeat(scene, beatDrag.dragging.id, beatDrag.dragging.to.container, beatDrag.dragging.to.index)) : scene;
  const issues = validate(scene, ctx);
  const red = blocks(issues);
  const missingRequired = (['arrival', 'descent', 'close', 'aftercare'] as const).filter((t) => !scene.phases.some((p) => p.type === t));
  const auto = automaticFlags(scene, ctx);
  const editingBeat = editing?.kind === 'beat' ? beatById(editing.beatId) : undefined;
  const setupPhase = editing?.kind === 'phase-setup' ? scene.phases.find((p) => p.id === editing.phaseId) : undefined;
  const editingPhase = editing?.kind === 'phase-time' ? scene.phases.find((p) => p.id === editing.phaseId) : undefined;
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
      {!scene.noRoles && <IntakeReminder role={scene.role} />}
      {scene.fromRequest && (
        <p className="box box-info">
          {scene.fromRequest.by} designed this for you ({new Date(scene.fromRequest.at).toLocaleDateString()}). It was built from their own answers; your offerings and settings now apply, so check anything flagged.
        </p>
      )}
      {changes.length > 0 && (
        <div className="box box-info">
          <strong>Changed for {scene.partnerName}:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="scene-map">
        <MiniCurve scene={shown} />
        <PhaseStrip scene={shown} />
      </div>
      <div className="person">
        <span className="note">
          Play time {playMinutes(scene)} min, then aftercare {scene.phases.filter((p) => p.type === 'aftercare').reduce((n, p) => n + phaseMinutes(p), 0)} min
        </span>
        <button type="button" className="btn btn-quiet" onClick={() => setEditing({ kind: 'play-time' })}>
          Change length
        </button>
      </div>
      {ctx.intake && <LimitStrip intake={ctx.intake} />}

      <IssueList scene={scene} issues={issues} onKeep={(key, reason) => apply({ ...scene, kept: { ...scene.kept, [key]: { reason, at: new Date().toISOString() } } })} />

      <Phases
        scene={scene}
        ctx={ctx}
        issues={issues}
        auto={auto}
        onApply={apply}
        beatDrag={beatDrag}
        stepDrag={stepDrag}
        onEditBeat={(phaseId, beatId) => setEditing({ kind: 'beat', phaseId, beatId })}
        onEditStep={(beatId, stepId) => setEditing({ kind: 'step', beatId, stepId })}
        onAddGear={(beatId) => setEditing({ kind: 'gear', beatId })}
        onAddActivity={(beatId) => setEditing({ kind: 'add-activity', beatId })}
        onDelete={(phaseId, beatId) => setDeleting({ phaseId, beatId })}
        onEditPhaseTime={(phaseId) => setEditing({ kind: 'phase-time', phaseId })}
        onEditSetup={(phaseId) => setEditing({ kind: 'phase-setup', phaseId })}
      />

      <section className="card stack" style={{ gap: 10 }} aria-label="Add a moment">
        <span className="field-label" style={{ fontSize: 16 }}>
          Add a moment
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['ritual', 'build', 'recovery', 'peak'] as const).map((t) => (
            <button key={t} type="button" className="btn btn-outline" onClick={() => addPhase(t)}>
              {phaseLabels[t]}
            </button>
          ))}
        </div>
        {missingRequired.length > 0 && (
          <>
            <span className="field-label">Put back</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {missingRequired.map((t) => (
                <button key={t} type="button" className="btn btn-outline" onClick={() => addPhase(t)}>
                  {phaseLabels[t]}
                </button>
              ))}
            </div>
          </>
        )}
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

      {scene.role === 'bottom' && scene.partnerId && (
        <RequestCard
          scene={scene}
          ctx={ctx}
          onChange={(next) => {
            setScene(next);
            setSaved('saved');
          }}
        />
      )}

      <div className="stack" style={{ gap: 8 }}>
        {scene.role === 'top' && !scene.noRoles && (scene.live || red.length === 0) && (
          <Link to={`/scenes/${scene.id}/live`} className="btn btn-primary btn-block">
            {scene.live && !scene.live.endedAt ? 'Back to the live scene' : scene.live ? 'Scene record' : 'Start the scene'}
          </Link>
        )}
        {scene.role === 'top' && !scene.noRoles && !scene.live && red.length > 0 && (
          <>
            <button type="button" className="btn btn-primary btn-block" disabled>
              Start the scene
            </button>
            <p className="note" style={{ margin: 0, textAlign: 'center' }}>
              Fix the red items above before starting.
            </p>
          </>
        )}
        {scene.role === 'top' && !scene.noRoles && (
          <Link to={`/scenes/${scene.id}/vibe`} className="btn btn-outline btn-block">
            {scene.share ? 'SceneVibe and plan' : scene.partnerId ? 'Share SceneVibe' : 'Preview SceneVibe'}
          </Link>
        )}
        <button type="button" className="btn btn-outline btn-block" onClick={() => setReusing(true)}>
          Share with someone
        </button>
        <button
          type="button"
          className="btn btn-outline btn-block"
          onClick={() => {
            if (!keys) return;
            const copy = copyScene(scene);
            saveScene(keys, copy)
              .then((s) => navigate(`/scenes/${s.id}`))
              .catch(() => setToast({ text: "Ember couldn't copy this scene." }));
          }}
        >
          Duplicate
        </button>
        <button type="button" className="btn btn-quiet btn-block" onClick={() => setConfirmDelete(true)}>
          Delete scene
        </button>
      </div>

      {reusing && <ReuseSheet scene={scene} onClose={() => setReusing(false)} />}
      {editing?.kind === 'play-time' && (
        <MinutesSheet
          title="Scene length"
          hint="Every moment keeps its share of the time. Aftercare comes after this, and grows if the new length needs more."
          value={playMinutes(scene)}
          min={20}
          max={480}
          onSave={(m) => apply(setPlayMinutes(scene, m, ctx.top.settings))}
          preview={(m) => preview(setPlayMinutes(scene, m, ctx.top.settings))}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'phase-time' && editingPhase && (
        <MinutesSheet
          title={`${phaseLabels[editingPhase.type]} length`}
          hint={editingPhase.type === 'aftercare' ? 'The moments inside keep their share of the time. It can grow, but not below your setting.' : 'The moments inside keep their share of the time. Aftercare grows if it needs to.'}
          value={phaseMinutes(editingPhase)}
          min={Math.max(1, editingPhase.beats.length)}
          max={480}
          onSave={(m) => {
            // Aftercare grows to fit a longer section; shortening aftercare itself is checked as is.
            return apply(setPhaseMinutes(scene, editingPhase.id, m));
          }}
          preview={(m) => preview(setPhaseMinutes(scene, editingPhase.id, m))}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'phase-setup' && setupPhase && (
        <SetupSheet
          phase={setupPhase}
          allowed={scene.agreed && { positions: scene.agreed.positions, furniture: scene.agreed.furniture }}
          onSave={(setup) => apply(mapPhases((p) => (p.id === setupPhase.id ? { ...p, setup } : p)))}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'beat' && editingBeat && (
        <BeatSheet
          beat={editingBeat}
          phaseId={editing.phaseId}
          phases={scene.phases}
          automatic={auto.get(editingBeat.id) ?? []}
          onSave={(b, to) => apply(withBeat(editing.phaseId, b, to))}
          onSaveWithCheckIn={(b, to) => apply({ ...withBeat(editing.phaseId, b, to), nextMorningCheckIn: true })}
          preview={(b, to) => preview(withBeat(editing.phaseId, b, to))}
          onDelete={() => {
            setDeleting({ phaseId: editing.phaseId, beatId: editingBeat.id });
            return null;
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'step' && editingStep && (
        <StepSheet
          step={editingStep}
          beatId={editing.beatId}
          phases={scene.phases}
          ctx={ctx}
          gear={data.gear}
          onSave={(s, o, to) => saveStep(editing.beatId, s, o, to)}
          onDelete={() => apply(mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === editing.beatId ? { ...b, steps: b.steps.filter((s) => s.id !== editingStep.id) } : b)) })))}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'gear' && beatById(editing.beatId) && (
        <GearSheet
          gear={data.gear.filter((g) => !ctx.optedOutGear.includes(g.id))}
          partnerName={scene.partnerId && !data.theirGearShown ? scene.partnerName : ''}
          onShowTheirGear={showTheirGear}
          onPick={(g) => {
            const beatId = editing.beatId;
            const step = newStep({ gearId: g.id, do: `Use the ${g.name.toLowerCase()}.` });
            const reason = apply(mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beatId ? { ...b, steps: [...b.steps, step] } : b)) })));
            if (reason) return reason;
            setEditing({ kind: 'step', beatId, stepId: step.id });
            return null;
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'add-activity' && beatById(editing.beatId) && (
        <AddActivitySheet
          ctx={ctx}
          onPick={(activityId, overrides) => {
            const beatId = editing.beatId;
            const step = newStep({ activityId });
            const reason = apply({
              ...mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beatId ? { ...b, steps: [...b.steps, step] } : b)) })),
              overrides: [...current.overrides, ...overrides]
            });
            if (reason) return reason;
            setEditing({ kind: 'step', beatId, stepId: step.id });
            return null;
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteMoment
          scene={scene}
          target={deleting}
          onDelete={(force) => {
            const { phaseId, beatId } = deleting;
            const next = beatId
              ? mapPhases((p) => (p.id === phaseId ? { ...p, beats: p.beats.filter((b) => b.id !== beatId) } : p))
              : { ...current, phases: current.phases.filter((p) => p.id !== phaseId) };
            const reason = apply(next, force);
            if (!reason) setDeleting(null);
            return reason;
          }}
          onClose={() => setDeleting(null)}
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
                  .catch((err) => setToast({ text: err instanceof AccountError ? err.message : "Ember couldn't delete this scene." }))
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
      {beatDrag.overlay}
      {stepDrag.overlay}
      {toast && (
        <div className={toast.info ? 'toast toast-info' : 'toast'} role={toast.info ? 'status' : 'alert'}>
          {toast.text}
        </div>
      )}
    </main>
  );
}

type Drag = ReturnType<typeof useMoveDrag>;

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
  beatDrag,
  stepDrag,
  onEditBeat,
  onEditStep,
  onAddGear,
  onEditPhaseTime,
  onEditSetup,
  onAddActivity,
  onDelete
}: {
  scene: Scene;
  ctx: RuleContext;
  issues: Issue[];
  auto: Map<string, { kind: string; text: string }[]>;
  onApply: (next: Scene) => string | null;
  beatDrag: Drag;
  stepDrag: Drag;
  onEditBeat: (phaseId: string, beatId: string) => void;
  onEditStep: (beatId: string, stepId: string) => void;
  onAddGear: (beatId: string) => void;
  onEditPhaseTime: (phaseId: string) => void;
  onEditSetup: (phaseId: string) => void;
  onAddActivity: (beatId: string) => void;
  onDelete: (phaseId: string, beatId?: string) => void;
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
              <button type="button" className="drag-handle" style={{ color: '#fff' }} {...reorder.handle(i, momentName(phase.type))}>
                ⠿
              </button>
              <strong style={{ flex: 1 }}>{phaseLabels[phase.type]}</strong>
              <button
                type="button"
                aria-label={`${phaseLabels[phase.type]}: ${phaseMinutes(phase)} minutes. Change length`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEditPhaseTime(phase.id);
                }}
                style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 999, padding: '4px 10px', minHeight: 36, fontWeight: 600, cursor: 'pointer' }}
              >
                {phaseMinutes(phase)} min ✎
              </button>
              <button
                type="button"
                aria-label={`Delete the ${momentName(phase.type)}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(phase.id);
                }}
                style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 999, width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <TrashIcon />
              </button>
            </summary>
            <button
              type="button"
              className="btn btn-quiet"
              style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', padding: '6px 12px', minHeight: 'var(--touch)' }}
              aria-label={`${phaseLabels[phase.type]} position and furniture: ${setupLabel(phase.setup) ?? 'not set'}. Change`}
              onClick={() => onEditSetup(phase.id)}
            >
              {setupLabel(phase.setup) ? <>📍 {setupLabel(phase.setup)} ✎</> : '+ Position and furniture'}
            </button>
            <Beats scene={scene} phase={phase} ctx={ctx} issues={issues} auto={auto} onApply={onApply} beatDrag={beatDrag} stepDrag={stepDrag} onEditBeat={onEditBeat} onEditStep={onEditStep} onAddGear={onAddGear} onAddActivity={onAddActivity} onDelete={(beatId) => onDelete(phase.id, beatId)} />
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
  beatDrag,
  stepDrag,
  onEditBeat,
  onEditStep,
  onAddGear,
  onAddActivity,
  onDelete
}: {
  scene: Scene;
  phase: Phase;
  ctx: RuleContext;
  issues: Issue[];
  auto: Map<string, { kind: string; text: string }[]>;
  onApply: (next: Scene) => string | null;
  beatDrag: Drag;
  stepDrag: Drag;
  onEditBeat: (phaseId: string, beatId: string) => void;
  onEditStep: (beatId: string, stepId: string) => void;
  onAddGear: (beatId: string) => void;
  onAddActivity: (beatId: string) => void;
  onDelete: (beatId: string) => void;
}) {
  const withBeats = (beats: Beat[]) => ({ ...scene, phases: scene.phases.map((p) => (p.id === phase.id ? { ...p, beats } : p)) });
  return (
    <div className="stack" style={{ gap: 10, padding: 10 }}>
      <div className="stack" style={{ gap: 10, minHeight: 24 }} {...beatDrag.container(phase.id)}>
      {phase.beats.map((beat) => {
        const item = beatDrag.item(beat.id);
        const mine = issues.filter((x) => x.beatId === beat.id && !(x.level === 'warn' && x.kept));
        return (
          <article
            key={beat.id}
            {...item}
            className={['card', 'stack', item.className].filter(Boolean).join(' ')}
            style={{ ...item.style, gap: 8, padding: 12 }}
            aria-label={beat.title || 'Moment'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" className="drag-handle" {...beatDrag.handle(beat.id, beat.title || 'moment')}>
                ⠿
              </button>
              <button type="button" onClick={() => onEditBeat(phase.id, beat.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, minHeight: 'var(--touch)', cursor: 'pointer' }}>
                <span style={{ fontWeight: 700, display: 'block' }}>{beat.title || 'Untitled moment'}</span>
                <span className="note">
                  {beat.minutes} min, intensity {beat.intensity}
                  {beat.areas.length ? `, ${beat.areas.length} ${beat.areas.length === 1 ? 'area' : 'areas'}` : ''}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                aria-label={`Delete ${beat.title || 'this moment'}`}
                onClick={() => onDelete(beat.id)}
                style={{ minHeight: 'var(--touch)', minWidth: 'var(--touch)', padding: 0 }}
              >
                <TrashIcon />
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
            <Steps beat={beat} ctx={ctx} stepDrag={stepDrag} onEditStep={onEditStep} onAddGear={onAddGear} onAddActivity={onAddActivity} />
          </article>
        );
      })}
      </div>
      <button
        type="button"
        className="btn btn-quiet"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onApply(withBeats([...phase.beats, newBeat({ title: 'New moment', intensity: Math.min(4, phase.beats.at(-1)?.intensity ?? 3) })]))}
      >
        + Add a moment inside
      </button>
    </div>
  );
}

function Steps({
  beat,
  ctx,
  stepDrag,
  onEditStep,
  onAddGear,
  onAddActivity
}: {
  beat: Beat;
  ctx: RuleContext;
  stepDrag: Drag;
  onEditStep: (beatId: string, stepId: string) => void;
  onAddGear: (beatId: string) => void;
  onAddActivity: (beatId: string) => void;
}) {
  const label = (s: Step) => {
    const gear = s.gearId ? ctx.gear.find((g) => g.id === s.gearId)?.name : undefined;
    const what = activityOf(ctx, s.activityId)?.label ?? (s.do.split('.')[0] || 'Care or connection');
    return gear && !what.toLowerCase().includes(gear.toLowerCase()) ? `${what} (${gear})` : what;
  };
  return (
    <ol className="stack" style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none' }} {...stepDrag.container(beat.id)}>
      {beat.steps.map((s) => {
        const item = stepDrag.item(s.id);
        return (
          <li key={s.id} {...item} style={{ ...item.style, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--ground)', borderRadius: 10 }}>
            <button type="button" className="drag-handle" {...stepDrag.handle(s.id, label(s))}>
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
      <li style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-quiet" onClick={() => onAddActivity(beat.id)}>
          + Add activity
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => onAddGear(beat.id)}>
          + Add gear
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

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const usualWhy: Record<'arrival' | 'peak' | 'descent' | 'close', string> = {
  arrival: 'Arrival is where you settle in together and say the signals aloud.',
  peak: 'The Peak Moment is the high point most scenes build toward.',
  descent: 'The Descent brings intensity down slowly, with a spoken landing line, before aftercare.',
  close: 'The Close names one true thing they did before aftercare begins.'
};

/**
 * Confirm before a moment, and everything inside it, is deleted (Michael,
 * Nov 25). Every section but aftercare can go once its warning is ticked
 * (Michael, Nov 26). A moment a safety rule needs can too, and its red item
 * stays until it's fixed; nothing sets aside the aftercare rules.
 */
function DeleteMoment({
  scene,
  target,
  onDelete,
  onClose
}: {
  scene: Scene;
  target: { phaseId: string; beatId?: string };
  onDelete: (force: boolean) => string | null;
  onClose: () => void;
}) {
  const [refused, setRefused] = useState('');
  const [understood, setUnderstood] = useState(false);
  const phase = scene.phases.find((p) => p.id === target.phaseId);
  const beat = target.beatId ? phase?.beats.find((b) => b.id === target.beatId) : undefined;
  if (!phase || (target.beatId && !beat)) return null;
  // Arrival, Peak Moment, Descent and Close can go after a warning; aftercare can't (Michael, Nov 26).
  const usual = !beat && (['arrival', 'peak', 'descent', 'close'] as PhaseType[]).includes(phase.type);
  const inAftercare = phase.type === 'aftercare';
  const needsTick = usual || (Boolean(refused) && !inAftercare);
  const name = beat ? beat.title || 'this moment' : `the ${momentName(phase.type)}`;
  const inner = beat ? 0 : phase.beats.length;
  const acts = beat ? beat.steps.length : phase.beats.reduce((n, b) => n + b.steps.length, 0);
  const parts = [inner ? `${inner} ${inner === 1 ? 'moment' : 'moments'} inside it` : '', acts ? `${acts} ${acts === 1 ? 'activity' : 'activities'}` : ''].filter(Boolean);
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="moment-delete-title">
      <div className="sheet">
        <h2 id="moment-delete-title">Delete {name}?</h2>
        <p>{parts.length ? `This also deletes ${parts.join(' and ')}.` : 'It has nothing in it yet.'}</p>
        {usual && (
          <p className="box box-warn">
            {usualWhy[phase.type as 'arrival' | 'peak' | 'descent' | 'close']} You can put it back later from "Add a moment".
          </p>
        )}
        {refused && (
          <p className="box box-block" role="alert">
            {refused}
            {inAftercare ? ' Aftercare is the one part every scene keeps.' : " The scene can't be started or sent until this is fixed."}
          </p>
        )}
        {needsTick && (
          <label className="choice" style={{ alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} style={{ marginTop: 4 }} />
            <span>I understand, and I want to delete it.</span>
          </label>
        )}
        {needsTick ? (
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={!understood}
            onClick={() => {
              const reason = onDelete(true);
              if (reason) setRefused(reason);
            }}
          >
            {refused ? 'Delete anyway' : 'Delete'}
          </button>
        ) : inAftercare && refused ? null : (
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => {
              const reason = onDelete(false);
              if (reason) setRefused(reason);
            }}
          >
            Delete
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
