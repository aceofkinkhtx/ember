import { aftercareMinutes } from '../../content/topDefaults';
import { activityOf, confirmationsFor, needsNextMorningCheckIn } from './rules';
export function adaptScene(source, ctx, target, patch = {}) {
    const changes = [];
    const now = new Date().toISOString();
    const scene = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        ...target,
        overrides: [],
        kept: {},
        request: undefined,
        share: undefined,
        live: undefined,
        checkAskedAt: undefined,
        fromRequest: undefined,
        inLibrary: false,
        createdAt: now,
        updatedAt: now,
        ...patch
    };
    for (const phase of scene.phases) {
        for (const beat of phase.beats) {
            beat.steps = beat.steps.filter((step) => {
                const a = activityOf(ctx, step.activityId);
                if (!a)
                    return true;
                const check = confirmationsFor(ctx, a);
                if ('blocked' in check) {
                    changes.push(`Took out ${a.label}: ${check.blocked}`);
                    return false;
                }
                if (check.confirm.length) {
                    changes.push(`Took out ${a.label}: it needs your own confirmation. Add it back from a step to confirm.`);
                    return false;
                }
                return true;
            });
            for (const step of beat.steps) {
                if (step.gearId && ctx.optedOutGear.includes(step.gearId)) {
                    step.gearId = null;
                    changes.push(`Took gear off a step in "${beat.title}": it's kept out of scenes with ${target.partnerName}.`);
                }
            }
        }
    }
    scene.picks = scene.picks.filter((p) => scene.phases.some((ph) => ph.beats.some((b) => b.steps.some((s) => s.activityId === p.activityId))));
    // Aftercare follows the new designer's setting.
    const after = scene.phases.find((p) => p.type === 'aftercare');
    if (after?.beats.length) {
        const play = scene.phases.filter((p) => p.type !== 'aftercare').reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
        const pct = scene.intense ? ctx.top.settings.intensePercent : ctx.top.settings.aftercarePercent;
        const need = aftercareMinutes(play, scene.intense, pct);
        const have = scene.phases.filter((p) => p.type === 'aftercare').reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
        if (have < need) {
            after.beats[0].minutes += need - have;
            changes.push(`Aftercare is now ${need} minutes, to match your setting.`);
        }
    }
    if (needsNextMorningCheckIn(scene, ctx))
        scene.nextMorningCheckIn = true;
    return { scene, changes };
}
