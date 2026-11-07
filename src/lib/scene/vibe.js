import { activities } from '../../data/activities';
function kindOf(a) {
    if (!a)
        return null;
    if (a.category === 'penetration')
        return a.id.startsWith('fingers-') ? 'digital' : 'penetration';
    return a.category;
}
/**
 * Builds the SceneVibe from a design. Only categories, times and intensities
 * leave the plan; activity names, gear, DO and SAY text, notes and flags never do.
 */
export function sceneVibe(scene, colors = {}, lookup = (id) => activities.find((a) => a.id === id)) {
    const segments = [];
    const markers = [];
    let t = 0;
    let peakNo = 0;
    // Each surprise counts once, even if it comes back in a later beat.
    const surprised = new Set();
    for (const phase of scene.phases) {
        if (phase.type === 'peak')
            peakNo += 1;
        for (const beat of phase.beats) {
            segments.push({ phase: phase.type, peakNo: phase.type === 'peak' ? peakNo : 0, from: t, minutes: beat.minutes, intensity: beat.intensity });
            const seen = new Set();
            beat.steps.forEach((step, i) => {
                const at = t + (beat.minutes * (i + 0.5)) / Math.max(1, beat.steps.length);
                if (step.surprise) {
                    surprised.add(step.activityId ?? step.id);
                    markers.push({ at, kind: 'surprise' });
                    return;
                }
                const kind = kindOf(step.activityId ? lookup(step.activityId) : undefined);
                // One marker per kind per beat keeps the picture calm.
                if (kind && !seen.has(kind)) {
                    seen.add(kind);
                    markers.push({ at, kind });
                }
            });
            t += beat.minutes;
        }
    }
    const after = scene.phases.filter((p) => p.type === 'aftercare');
    return {
        v: 1,
        sceneId: scene.id,
        title: scene.title,
        date: scene.date,
        startTime: scene.startTime,
        minutes: t,
        aftercareMinutes: after.reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0),
        location: scene.location,
        isPublic: scene.isPublic,
        intense: scene.intense,
        segments,
        markers,
        surprises: surprised.size,
        prepare: scene.prepare ?? '',
        aftercare: after.flatMap((p) => p.beats.map((b) => b.title)).filter(Boolean),
        colors,
        updatedAt: new Date().toISOString()
    };
}
/**
 * The plan as sent to the bottom, when the Top chooses to send it. Surprises
 * stay hidden unless the Top chooses to reveal them.
 */
export function planToSend(scene, revealSurprises) {
    const copy = structuredClone(scene);
    // The Top's own records stay with the Top.
    copy.kept = {};
    copy.overrides = [];
    copy.picks = revealSurprises ? copy.picks : copy.picks.filter((p) => !p.surprise);
    copy.gearIds = [];
    copy.notes = '';
    copy.request = undefined;
    copy.share = undefined;
    // Step notes are the Top's own; everything else in a step is the plan itself.
    for (const phase of copy.phases)
        for (const beat of phase.beats)
            beat.steps = beat.steps.map((s) => ({ ...s, notes: '' }));
    if (!revealSurprises) {
        for (const phase of copy.phases)
            for (const beat of phase.beats)
                beat.steps = beat.steps.map((s) => s.surprise ? { ...s, activityId: null, gearId: null, do: 'A surprise. Your Top has something planned here.', say: '', watch: '', notes: '' } : s);
    }
    return copy;
}
