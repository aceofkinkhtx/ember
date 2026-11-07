import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BeatSheet, MinutesSheet, StepSheet } from '../../components/scene/EditSheets';
import { moveStep, placeBeat, placeStep, playMinutes, setPhaseMinutes, setPlayMinutes, withAftercareFit } from '../../lib/scene/timing';
import { MiniCurve, PhaseStrip, sceneFacts, usePhaseColor } from '../../components/scene/SceneCurve';
import { RequestCard, ReuseSheet } from '../../components/scene/SceneActions';
import { moved, useReorder } from '../../components/scene/useReorder';
import { useMoveDrag } from '../../components/scene/useMoveDrag';
import { LimitStrip } from '../../components/intake/IntakeSummary';
import { SettingSwitch } from '../../components/Switch';
import { phaseLabels } from '../../content/phases';
import { fixed, shapes } from '../../content/sceneText';
import { AccountError } from '../../lib/account';
import { newBeat, newId, newStep, phaseMinutes } from '../../lib/scene/model';
import { activityOf, automaticFlags, blocks, needsNextMorningCheckIn, tryChange, validate, warnings } from '../../lib/scene/rules';
import { copyScene, deleteScene, listScenes, saveScene } from '../../lib/scenes';
import { shareVibe } from '../../lib/vibes';
import { useSettings } from '../../state/settings';
import { useAccount } from '../../state/account';
import { useSceneData } from '../../state/sceneContext';
export function SceneEditor() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const { keys } = useAccount();
    const { settings } = useSettings();
    const [scene, setScene] = useState(undefined);
    const [saved, setSaved] = useState('saved');
    const [toast, setToast] = useState(null);
    const [editing, setEditing] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [reusing, setReusing] = useState(false);
    const changes = useLocation().state?.changes ?? [];
    const { data, showTheirGear } = useSceneData(scene?.connectionId ?? null, scene?.partnerId ?? null, scene?.role ?? 'top');
    const timer = useRef(undefined);
    // Drops land through the latest scene, set once it has loaded.
    const drop = useRef({ beat: () => { }, step: () => { } });
    const beatDrag = useMoveDrag('beat', (id, to) => drop.current.beat(id, to));
    const stepDrag = useMoveDrag('step', (id, to) => drop.current.step(id, to));
    useEffect(() => {
        if (!keys)
            return;
        listScenes(keys)
            .then((all) => setScene(all.find((s) => s.id === id) ?? null))
            .catch(() => setScene(null));
    }, [keys, id]);
    // Gear from the partner's collection shows by name once their shared gear is loaded.
    const usesTheirGear = Boolean(scene && data && !data.theirGearShown && scene.phases.some((p) => p.beats.some((b) => b.steps.some((st) => st.gearId && !data.gear.some((g) => g.id === st.gearId)))));
    useEffect(() => {
        if (usesTheirGear)
            void showTheirGear();
    }, [usesTheirGear, showTheirGear]);
    useEffect(() => {
        if (!toast)
            return;
        const t = window.setTimeout(() => setToast(null), 4000);
        return () => window.clearTimeout(t);
    }, [toast]);
    if (scene === undefined || (scene && data === undefined)) {
        return (_jsx("main", { className: "screen", children: _jsx("p", { className: "note", children: "Loading..." }) }));
    }
    if (!scene || !data) {
        return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Scenes" }), _jsx("p", { className: "card", children: "That scene isn't available." })] }));
    }
    const ctx = data.ctx;
    const current = scene;
    function persist(next) {
        if (!keys)
            return;
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
    /** Applies an edit if the rules allow it; returns the reason if not. */
    function apply(edit) {
        const { scene: next, grewBy } = withAftercareFit(current, edit, ctx.top.settings);
        const result = tryChange(current, next, ctx);
        if (!result.ok) {
            setToast({ text: result.reason });
            return result.reason;
        }
        // The next-morning check-in turns on by itself when the scene needs it.
        const fixedUp = needsNextMorningCheckIn(next, ctx) ? { ...next, nextMorningCheckIn: true } : next;
        setScene(fixedUp);
        persist(fixedUp);
        if (grewBy > 0)
            setToast({ text: `Aftercare extended by ${grewBy} min to match the longer scene.`, info: true });
        return null;
    }
    drop.current = {
        beat: (beatId, to) => apply(placeBeat(current, beatId, to.container, to.index)),
        step: (stepId, to) => apply(placeStep(current, stepId, to.container, to.index))
    };
    const mapPhases = (fn) => ({ ...current, phases: current.phases.map(fn) });
    const beatById = (beatId) => current.phases.flatMap((p) => p.beats).find((b) => b.id === beatId);
    function withBeat(phaseId, beat, toPhase) {
        if (toPhase === phaseId)
            return mapPhases((p) => (p.id === phaseId ? { ...p, beats: p.beats.map((b) => (b.id === beat.id ? beat : b)) } : p));
        return mapPhases((p) => {
            if (p.id === phaseId)
                return { ...p, beats: p.beats.filter((b) => b.id !== beat.id) };
            if (p.id === toPhase)
                return { ...p, beats: [...p.beats, beat] };
            return p;
        });
    }
    /** What an edit would look like, aftercare included, for the live map. */
    const preview = (edit) => withAftercareFit(current, edit, ctx.top.settings).scene;
    function saveStep(beatId, step, overrides, toBeatId) {
        const next = mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beatId ? { ...b, steps: b.steps.map((s) => (s.id === step.id ? step : s)) } : b)) }));
        const placed = toBeatId === beatId ? next : moveStep(next, step, toBeatId);
        return apply({ ...placed, overrides: [...current.overrides, ...overrides] });
    }
    function addPhase(type) {
        const beat = type === 'recovery'
            ? newBeat({ kind: 'recovery', title: fixed.recovery.title, minutes: 5, intensity: 2, steps: [newStep({ do: fixed.recovery.do, say: fixed.recovery.say })] })
            : type === 'ritual'
                ? newBeat({ kind: 'ritual', title: 'Opening ritual', minutes: 5, intensity: 2, steps: [newStep({ do: 'Posture, clothing and objects.', say: 'The words you say together.' })] })
                : newBeat({ title: phaseLabels[type], minutes: 10, intensity: type === 'peak' ? 6 : 4, steps: [newStep()] });
        const phase = { id: newId('p'), type, beats: [beat] };
        // New phases go before the descent; a ritual goes right after arrival.
        const at = type === 'ritual' ? 1 : Math.max(1, current.phases.findIndex((p) => p.type === 'descent'));
        const phases = [...current.phases];
        phases.splice(at < 0 ? phases.length - 1 : at, 0, phase);
        apply({ ...current, phases });
    }
    // While a beat is dragged, the map shows where it would land.
    const shown = beatDrag.dragging ? preview(placeBeat(scene, beatDrag.dragging.id, beatDrag.dragging.to.container, beatDrag.dragging.to.index)) : scene;
    const issues = validate(scene, ctx);
    const auto = automaticFlags(scene, ctx);
    const editingBeat = editing?.kind === 'beat' ? beatById(editing.beatId) : undefined;
    const editingPhase = editing?.kind === 'phase-time' ? scene.phases.find((p) => p.id === editing.phaseId) : undefined;
    const editingStep = editing?.kind === 'step' ? beatById(editing.beatId)?.steps.find((s) => s.id === editing.stepId) : undefined;
    return (_jsxs("main", { className: "screen", children: [_jsxs("div", { className: "person", children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", children: "\u2039 Scenes" }), _jsx("span", { className: "note", "aria-live": "polite", children: saved === 'saving' ? 'Saving...' : saved === 'error' ? "Couldn't save. Check your connection." : 'Saved' })] }), _jsxs("div", { children: [_jsx("h1", { style: { marginBottom: 4 }, children: scene.title }), _jsxs("p", { className: "note", style: { margin: 0 }, children: [scene.partnerName ? `With ${scene.partnerName}. ` : '', shapes[scene.shape].label, ", ", sceneFacts(scene), scene.intense ? ', intense' : '', "."] })] }), scene.fromRequest && (_jsxs("p", { className: "box box-info", children: [scene.fromRequest.by, " designed this for you (", new Date(scene.fromRequest.at).toLocaleDateString(), "). It was built from their own answers; your offerings and settings now apply, so check anything flagged."] })), changes.length > 0 && (_jsxs("div", { className: "box box-info", children: [_jsxs("strong", { children: ["Changed for ", scene.partnerName, ":"] }), _jsx("ul", { style: { margin: '4px 0 0', paddingLeft: 18 }, children: changes.map((c, i) => (_jsx("li", { children: c }, i))) })] })), _jsxs("div", { className: "scene-map", children: [_jsx(MiniCurve, { scene: shown }), _jsx(PhaseStrip, { scene: shown })] }), _jsxs("div", { className: "person", children: [_jsxs("span", { className: "note", children: ["Play time ", playMinutes(scene), " min, then aftercare ", scene.phases.filter((p) => p.type === 'aftercare').reduce((n, p) => n + phaseMinutes(p), 0), " min"] }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => setEditing({ kind: 'play-time' }), children: "Change length" })] }), ctx.intake && _jsx(LimitStrip, { intake: ctx.intake }), _jsx(IssueList, { scene: scene, issues: issues, onKeep: (key, reason) => apply({ ...scene, kept: { ...scene.kept, [key]: { reason, at: new Date().toISOString() } } }) }), _jsx(Phases, { scene: scene, ctx: ctx, issues: issues, auto: auto, onApply: apply, beatDrag: beatDrag, stepDrag: stepDrag, onEditBeat: (phaseId, beatId) => setEditing({ kind: 'beat', phaseId, beatId }), onEditStep: (beatId, stepId) => setEditing({ kind: 'step', beatId, stepId }), onEditPhaseTime: (phaseId) => setEditing({ kind: 'phase-time', phaseId }) }), _jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": "Add a phase", children: [_jsx("span", { className: "field-label", style: { fontSize: 16 }, children: "Add to the arc" }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", className: "btn btn-outline", onClick: () => addPhase('ritual'), children: "Ritual" }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => addPhase('build'), children: "Build" }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => addPhase('recovery'), children: "Recovery" }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => addPhase('peak'), children: "Peak" })] }), _jsx("p", { className: "note", style: { margin: 0 }, children: "Aftercare always stays last." })] }), _jsxs("section", { className: "card stack", style: { gap: 12 }, children: [_jsx(SettingSwitch, { label: "Next-morning check-in", description: needsNextMorningCheckIn(scene, ctx) ? 'Required: this scene may reach subspace or release.' : 'A check-in with them the morning after.', checked: scene.nextMorningCheckIn, onChange: (on) => apply({ ...scene, nextMorningCheckIn: on }) }), _jsx(SettingSwitch, { label: "Keep in my library", description: "Saved designs can be reused and changed.", checked: scene.inLibrary, onChange: (inLibrary) => apply({ ...scene, inLibrary }) })] }), _jsx(Record, { scene: scene, ctx: ctx }), scene.role === 'bottom' && scene.partnerId && (_jsx(RequestCard, { scene: scene, ctx: ctx, onChange: (next) => {
                    setScene(next);
                    setSaved('saved');
                } })), _jsxs("div", { className: "stack", style: { gap: 8 }, children: [scene.role === 'top' && (_jsx(Link, { to: `/scenes/${scene.id}/live`, className: "btn btn-primary btn-block", children: scene.live && !scene.live.endedAt ? 'Back to the live scene' : scene.live ? 'Scene record' : 'Start the scene' })), scene.role === 'top' && (_jsx(Link, { to: `/scenes/${scene.id}/vibe`, className: "btn btn-outline btn-block", children: scene.share ? 'SceneVibe and plan' : scene.partnerId ? 'Share SceneVibe' : 'Preview SceneVibe' })), _jsx("button", { type: "button", className: "btn btn-outline btn-block", onClick: () => setReusing(true), children: "Use with someone else" }), _jsx("button", { type: "button", className: "btn btn-outline btn-block", onClick: () => {
                            if (!keys)
                                return;
                            const copy = copyScene(scene);
                            saveScene(keys, copy)
                                .then((s) => navigate(`/scenes/${s.id}`))
                                .catch(() => setToast({ text: "Ember couldn't copy this scene." }));
                        }, children: "Duplicate" }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => setConfirmDelete(true), children: "Delete scene" })] }), reusing && _jsx(ReuseSheet, { scene: scene, onClose: () => setReusing(false) }), editing?.kind === 'play-time' && (_jsx(MinutesSheet, { title: "Scene length", hint: "Every section keeps its share of the time. Aftercare comes after this, and grows if the new length needs more.", value: playMinutes(scene), min: 20, max: 480, onSave: (m) => apply(setPlayMinutes(scene, m, ctx.top.settings)), preview: (m) => preview(setPlayMinutes(scene, m, ctx.top.settings)), onClose: () => setEditing(null) })), editing?.kind === 'phase-time' && editingPhase && (_jsx(MinutesSheet, { title: `${phaseLabels[editingPhase.type]} length`, hint: editingPhase.type === 'aftercare' ? 'Its beats keep their share of the time. It can grow, but not below your setting.' : 'Its beats keep their share of the time. Aftercare grows if it needs to.', value: phaseMinutes(editingPhase), min: Math.max(1, editingPhase.beats.length), max: 480, onSave: (m) => {
                    // Aftercare grows to fit a longer section; shortening aftercare itself is checked as is.
                    return apply(setPhaseMinutes(scene, editingPhase.id, m));
                }, preview: (m) => preview(setPhaseMinutes(scene, editingPhase.id, m)), onClose: () => setEditing(null) })), editing?.kind === 'beat' && editingBeat && (_jsx(BeatSheet, { beat: editingBeat, phaseId: editing.phaseId, phases: scene.phases, automatic: auto.get(editingBeat.id) ?? [], onSave: (b, to) => apply(withBeat(editing.phaseId, b, to)), preview: (b, to) => preview(withBeat(editing.phaseId, b, to)), onDelete: () => apply(mapPhases((p) => ({ ...p, beats: p.beats.filter((b) => b.id !== editingBeat.id) }))), onClose: () => setEditing(null) })), editing?.kind === 'step' && editingStep && (_jsx(StepSheet, { step: editingStep, beatId: editing.beatId, phases: scene.phases, ctx: ctx, gear: data.gear, onSave: (s, o, to) => saveStep(editing.beatId, s, o, to), onDelete: () => apply(mapPhases((p) => ({ ...p, beats: p.beats.map((b) => (b.id === editing.beatId ? { ...b, steps: b.steps.filter((s) => s.id !== editingStep.id) } : b)) }))), onClose: () => setEditing(null) })), confirmDelete && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "scene-delete-title", children: _jsxs("div", { className: "sheet", children: [_jsxs("h2", { id: "scene-delete-title", children: ["Delete ", scene.title, "?"] }), _jsx("p", { children: "The design and its record are removed. This can't be undone." }), _jsx("button", { type: "button", className: "btn btn-danger btn-block", onClick: () => deleteScene(scene.id)
                                .then(() => navigate('/scenes', { replace: true }))
                                .catch((err) => setToast({ text: err instanceof AccountError ? err.message : "Ember couldn't delete this scene." })), children: "Delete" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => setConfirmDelete(false), children: "Cancel" })] }) })), beatDrag.overlay, stepDrag.overlay, toast && (_jsx("div", { className: toast.info ? 'toast toast-info' : 'toast', role: toast.info ? 'status' : 'alert', children: toast.text }))] }));
}
function IssueList({ scene, issues, onKeep }) {
    const [keeping, setKeeping] = useState(null);
    const [reason, setReason] = useState('');
    const open = [...blocks(issues), ...warnings(issues).filter((w) => !w.kept)];
    if (!open.length)
        return null;
    return (_jsxs("section", { className: "stack", style: { gap: 6 }, "aria-label": "Things to look at", children: [open.map((i) => (_jsxs("div", { className: `box ${i.level === 'block' ? 'box-block' : 'box-warn'}`, children: [i.message, i.level === 'warn' && (_jsx(KeepControl, { id: i.key, keeping: keeping, reason: reason, setKeeping: setKeeping, setReason: setReason, onKeep: onKeep }))] }, i.key))), scene.phases.length === 0 && _jsx("p", { className: "note", children: "This design is empty." })] }));
}
function KeepControl({ id, keeping, reason, setKeeping, setReason, onKeep }) {
    if (keeping !== id) {
        return (_jsx("button", { type: "button", className: "btn btn-quiet", style: { minHeight: 32, padding: '2px 6px', marginLeft: 6 }, onClick: () => { setKeeping(id); setReason(''); }, children: "Keep anyway" }));
    }
    return (_jsxs("span", { style: { display: 'flex', gap: 6, marginTop: 6 }, children: [_jsx("input", { className: "input", "aria-label": "Your reason", placeholder: "Your reason", maxLength: 160, value: reason, onChange: (e) => setReason(e.target.value), style: { flex: 1, minHeight: 40, padding: '6px 10px' } }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: !reason.trim(), onClick: () => { onKeep(id, reason.trim()); setKeeping(null); }, children: "Keep" })] }));
}
function Phases({ scene, ctx, issues, auto, onApply, beatDrag, stepDrag, onEditBeat, onEditStep, onEditPhaseTime }) {
    const colorOf = usePhaseColor();
    const reorder = useReorder(scene.phases.length, (from, to) => onApply({ ...scene, phases: moved(scene.phases, from, to) }));
    return (_jsx("div", { className: "stack", style: { gap: 12 }, children: scene.phases.map((phase, i) => {
            const color = colorOf(scene, phase);
            const item = reorder.item(i);
            return (_jsxs("details", { open: true, ref: item.ref, className: item.className, style: { ...item.style, borderRadius: 16, background: 'var(--surface)', border: `2px solid ${color}` }, children: [_jsxs("summary", { style: { listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', background: color, color: '#fff', borderRadius: '12px 12px 0 0', cursor: 'pointer' }, children: [_jsx("button", { type: "button", className: "drag-handle", style: { color: '#fff' }, ...reorder.handle(i, `${phaseLabels[phase.type]} phase`), children: "\u283F" }), _jsx("strong", { style: { flex: 1 }, children: phaseLabels[phase.type] }), _jsxs("button", { type: "button", "aria-label": `${phaseLabels[phase.type]}: ${phaseMinutes(phase)} minutes. Change length`, onClick: (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEditPhaseTime(phase.id);
                                }, style: { background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 999, padding: '4px 10px', minHeight: 36, fontWeight: 600, cursor: 'pointer' }, children: [phaseMinutes(phase), " min \u270E"] })] }), _jsx(Beats, { scene: scene, phase: phase, ctx: ctx, issues: issues, auto: auto, onApply: onApply, beatDrag: beatDrag, stepDrag: stepDrag, onEditBeat: onEditBeat, onEditStep: onEditStep })] }, phase.id));
        }) }));
}
function Beats({ scene, phase, ctx, issues, auto, onApply, beatDrag, stepDrag, onEditBeat, onEditStep }) {
    const withBeats = (beats) => ({ ...scene, phases: scene.phases.map((p) => (p.id === phase.id ? { ...p, beats } : p)) });
    return (_jsxs("div", { className: "stack", style: { gap: 10, padding: 10 }, children: [_jsx("div", { className: "stack", style: { gap: 10, minHeight: 24 }, ...beatDrag.container(phase.id), children: phase.beats.map((beat) => {
                    const item = beatDrag.item(beat.id);
                    const mine = issues.filter((x) => x.beatId === beat.id && !(x.level === 'warn' && x.kept));
                    return (_jsxs("article", { ...item, className: ['card', 'stack', item.className].filter(Boolean).join(' '), style: { ...item.style, gap: 8, padding: 12 }, "aria-label": beat.title || 'Beat', children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("button", { type: "button", className: "drag-handle", ...beatDrag.handle(beat.id, beat.title || 'beat'), children: "\u283F" }), _jsxs("button", { type: "button", onClick: () => onEditBeat(phase.id, beat.id), style: { flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, minHeight: 'var(--touch)', cursor: 'pointer' }, children: [_jsx("span", { style: { fontWeight: 700, display: 'block' }, children: beat.title || 'Untitled beat' }), _jsxs("span", { className: "note", children: [beat.minutes, " min, intensity ", beat.intensity, beat.areas.length ? `, ${beat.areas.length} ${beat.areas.length === 1 ? 'area' : 'areas'}` : ''] })] })] }), mine.map((x) => (_jsx("p", { className: `box ${x.level === 'block' ? 'box-block' : 'box-warn'}`, children: x.message }, x.key))), (auto.get(beat.id) ?? []).filter((f) => f.kind === 'warning').map((f, k) => (_jsx("p", { className: "box box-warning", children: f.text }, `a${k}`))), beat.flags.map((f, k) => (_jsx("p", { className: `box box-${f.kind}`, children: f.text }, `f${k}`))), _jsx(Steps, { scene: scene, beat: beat, ctx: ctx, onApply: onApply, stepDrag: stepDrag, onEditStep: onEditStep })] }, beat.id));
                }) }), _jsx("button", { type: "button", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, onClick: () => onApply(withBeats([...phase.beats, newBeat({ title: 'New beat', intensity: Math.min(4, phase.beats.at(-1)?.intensity ?? 3), steps: [newStep()] })])), children: "+ Add beat" })] }));
}
function Steps({ scene, beat, ctx, onApply, stepDrag, onEditStep }) {
    const withSteps = (steps) => ({ ...scene, phases: scene.phases.map((p) => ({ ...p, beats: p.beats.map((b) => (b.id === beat.id ? { ...b, steps } : b)) })) });
    const label = (s) => {
        const gear = s.gearId ? ctx.gear.find((g) => g.id === s.gearId)?.name : undefined;
        const what = activityOf(ctx, s.activityId)?.label ?? (s.do.split('.')[0] || 'Step');
        return gear ? `${what} (${gear})` : what;
    };
    return (_jsxs("ol", { className: "stack", style: { gap: 4, margin: 0, padding: 0, listStyle: 'none' }, ...stepDrag.container(beat.id), children: [beat.steps.map((s) => {
                const item = stepDrag.item(s.id);
                return (_jsxs("li", { ...item, style: { ...item.style, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--ground)', borderRadius: 10 }, children: [_jsx("button", { type: "button", className: "drag-handle", ...stepDrag.handle(s.id, label(s)), children: "\u283F" }), _jsxs("button", { type: "button", onClick: () => onEditStep(beat.id, s.id), style: { flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: '6px 0', minHeight: 'var(--touch)', cursor: 'pointer' }, children: [_jsxs("span", { style: { display: 'block', fontWeight: 600 }, children: [label(s), s.surprise ? ' (surprise)' : ''] }), s.say && _jsxs("span", { className: "note", children: ["SAY: ", s.say] })] })] }, s.id));
            }), _jsx("li", { children: _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => onApply(withSteps([...beat.steps, newStep()])), children: "+ Add step" }) })] }));
}
function Record({ scene, ctx }) {
    const entries = [
        ...scene.overrides.map((o) => ({
            at: o.confirmedAt,
            text: `${activityOf(ctx, o.activityId)?.label ?? o.activityId}: ${o.kind === 'no' ? 'they said no; you confirmed you talked and agreed' : o.kind === 'edge' ? 'edge play, negotiation confirmed' : 'negotiated for this scene'}`
        })),
        ...Object.entries(scene.kept).map(([key, k]) => ({ at: k.at, text: `Kept a warning (${key.split(':')[0]}): ${k.reason}` }))
    ].sort((a, b) => a.at.localeCompare(b.at));
    if (!entries.length)
        return null;
    return (_jsxs("section", { className: "card stack", style: { gap: 6 }, "aria-label": "Record", children: [_jsx("div", { className: "eyebrow", children: "Record" }), _jsxs("p", { className: "note", style: { margin: 0 }, children: ["Every override and kept warning, dated. Designed from intake version ", scene.intakeVersion ?? 'none', "."] }), _jsx("ul", { style: { margin: 0, paddingLeft: 18 }, children: entries.map((e, i) => (_jsxs("li", { children: [new Date(e.at).toLocaleDateString(), ": ", e.text] }, i))) })] }));
}
