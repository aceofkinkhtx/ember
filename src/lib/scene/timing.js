import { aftercareMinutes } from '../../content/topDefaults';
// Changing time in the editor: a whole section, or the whole scene. Beats keep
// their share of the time; aftercare grows if the new length needs more.
/** Spreads a new total across beats in proportion to their current lengths. */
export function scaleBeats(beats, total) {
    const now = beats.reduce((n, b) => n + b.minutes, 0);
    if (!beats.length)
        return beats;
    const target = Math.max(beats.length, Math.round(total));
    const scaled = beats.map((b) => ({ ...b, minutes: Math.max(1, Math.round((b.minutes / Math.max(1, now)) * target)) }));
    // Put any rounding difference on the longest beat.
    const diff = target - scaled.reduce((n, b) => n + b.minutes, 0);
    const longest = scaled.reduce((best, b, i) => (b.minutes > scaled[best].minutes ? i : best), 0);
    scaled[longest] = { ...scaled[longest], minutes: Math.max(1, scaled[longest].minutes + diff) };
    return scaled;
}
export function setPhaseMinutes(scene, phaseId, minutes) {
    return { ...scene, phases: scene.phases.map((p) => (p.id === phaseId ? { ...p, beats: scaleBeats(p.beats, minutes) } : p)) };
}
export const playMinutes = (scene) => scene.phases.filter((p) => p.type !== 'aftercare').reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
/** Aftercare grows to the designer's setting for the current play time; it never shrinks here. */
export function fitAftercare(scene, settings) {
    const after = scene.phases.filter((p) => p.type === 'aftercare');
    const have = after.reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
    const pct = scene.intense ? settings.intensePercent : settings.aftercarePercent;
    const need = aftercareMinutes(playMinutes(scene), scene.intense, pct);
    if (!after.length || have >= need)
        return scene;
    const first = after[0];
    return { ...scene, phases: scene.phases.map((p) => (p.id === first.id ? { ...p, beats: scaleBeats(p.beats, p.beats.reduce((m, b) => m + b.minutes, 0) + need - have) } : p)) };
}
/** A new play time, spread across every section but aftercare, which then fits itself. */
export function setPlayMinutes(scene, minutes, settings) {
    const play = scene.phases.filter((p) => p.type !== 'aftercare');
    const now = playMinutes(scene);
    const shares = play.map((p) => p.beats.reduce((m, b) => m + b.minutes, 0) / Math.max(1, now));
    let used = 0;
    const totals = shares.map((share, i) => {
        const t = i === shares.length - 1 ? Math.max(1, minutes - used) : Math.max(1, Math.round(share * minutes));
        used += t;
        return t;
    });
    let k = 0;
    const next = {
        ...scene,
        minutes,
        phases: scene.phases.map((p) => (p.type === 'aftercare' ? p : { ...p, beats: scaleBeats(p.beats, totals[k++]) }))
    };
    return fitAftercare(next, settings);
}
/** Moves a step to another beat, at its end. */
export function moveStep(scene, step, toBeatId) {
    const phases = scene.phases.map((p) => ({
        ...p,
        beats: p.beats.map((b) => {
            const kept = b.steps.filter((s) => s.id !== step.id);
            return { ...b, steps: b.id === toBeatId ? [...kept, step] : kept };
        })
    }));
    return { ...scene, phases };
}
/** Moves a step to a place in any beat; the index counts the beat's other steps. */
export function placeStep(scene, stepId, toBeatId, index) {
    const step = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps)).find((s) => s.id === stepId);
    if (!step)
        return scene;
    const phases = scene.phases.map((p) => ({
        ...p,
        beats: p.beats.map((b) => {
            const kept = b.steps.filter((s) => s.id !== stepId);
            if (b.id === toBeatId)
                kept.splice(Math.max(0, Math.min(index, kept.length)), 0, step);
            return { ...b, steps: kept };
        })
    }));
    return { ...scene, phases };
}
/** Moves a beat to a place in any section; the index counts the section's other beats. */
export function placeBeat(scene, beatId, toPhaseId, index) {
    const beat = scene.phases.flatMap((p) => p.beats).find((b) => b.id === beatId);
    if (!beat)
        return scene;
    const phases = scene.phases.map((p) => {
        const kept = p.beats.filter((b) => b.id !== beatId);
        if (p.id === toPhaseId)
            kept.splice(Math.max(0, Math.min(index, kept.length)), 0, beat);
        return { ...p, beats: kept };
    });
    return { ...scene, phases };
}
export const aftercareTotal = (scene) => scene.phases.filter((p) => p.type === 'aftercare').reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
/**
 * An edit that makes play longer: aftercare grows to match, and the result says
 * by how much. An edit that shortens aftercare itself is left as it is, so the
 * rules can say no.
 */
export function withAftercareFit(before, next, settings) {
    const raw = aftercareTotal(next);
    const fitted = raw < aftercareTotal(before) ? next : fitAftercare(next, settings);
    return { scene: { ...fitted, minutes: playMinutes(fitted) }, grewBy: aftercareTotal(fitted) - raw };
}
