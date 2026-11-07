let counter = 0;
/** Short ids for phases, beats and steps, unique within a scene. */
export function newId(prefix) {
    counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
export function newStep(patch = {}) {
    return { id: newId('s'), activityId: null, do: '', say: '', watch: '', notes: '', gearId: null, surprise: false, ...patch };
}
export function newBeat(patch = {}) {
    return { id: newId('b'), kind: 'regular', title: '', minutes: 5, intensity: 3, areas: [], positions: [], flags: [], steps: [], ...patch };
}
export const sceneMinutes = (scene) => scene.phases.reduce((n, p) => n + phaseMinutes(p), 0);
export const phaseMinutes = (phase) => phase.beats.reduce((n, b) => n + b.minutes, 0);
/** Every beat in order, with its phase. */
export function beatsInOrder(scene) {
    const out = [];
    for (const phase of scene.phases)
        for (const beat of phase.beats)
            out.push({ phase, beat, index: out.length });
    return out;
}
export function peakCount(scene) {
    return scene.phases.filter((p) => p.type === 'peak').length;
}
