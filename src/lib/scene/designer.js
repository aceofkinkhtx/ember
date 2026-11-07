import { aftercareMap, quadrantOf } from '../../content/intake';
import { aftercareStyle, doText, fixed, sayFor, shapeForFlow, shapes } from '../../content/sceneText';
import { isOffered } from '../../content/topSetup';
import { aftercareMinutes } from '../../content/topDefaults';
import { newBeat, newId, newStep } from './model';
import { activityOf, choiceOf, needsNextMorningCheckIn } from './rules';
// The auto-designer: two or three starting designs built only from the
// bottom's yes items that the Top offers. Each option is a different arc shape;
// the one that fits the bottom's Flow word comes first. Every design it makes
// passes all block rules (tested), and the Top edits from there.
/** Yes items the Top offers, with a starting intensity for each. Edge play and negotiated-only acts are never suggested. */
export function suggestedPicks(ctx) {
    const answers = ctx.intake?.detailed?.answers ?? {};
    const picks = [];
    for (const [id, answer] of Object.entries(answers)) {
        if (answer.choice !== 'yes')
            continue;
        const a = activityOf(ctx, id);
        if (!a || a.edge || a.negotiatedOnly)
            continue;
        if (!a.custom && !isOffered(ctx.top, a, ctx.studio))
            continue;
        const range = ctx.top.offerings.categories[a.category];
        // Up to how far the Top goes, or less if the bottom said so.
        const max = range?.max ?? 6;
        picks.push({ activityId: id, intensity: Math.min(max, answer.intensity ?? max), surprise: false });
    }
    return picks;
}
/** The shapes to offer, the one that fits their Flow word first. */
export function shapeOrder(ctx) {
    const flow = ctx.intake?.quick?.words.flow ?? [];
    const preferred = flow.map((w) => shapeForFlow[w]).find(Boolean);
    const all = ['climb', 'twin', 'waves'];
    return preferred ? [preferred, ...all.filter((s) => s !== preferred)] : all;
}
/** How each shape splits play time, in order. */
const plans = {
    climb: [['arrival', 0.1], ['build', 0.4], ['peak', 0.25], ['descent', 0.15], ['close', 0.1]],
    twin: [['arrival', 0.08], ['build', 0.22], ['peak', 0.12], ['recovery', 0.08], ['peak', 0.25], ['descent', 0.15], ['close', 0.1]],
    waves: [['arrival', 0.08], ['build', 0.17], ['peak', 0.1], ['recovery', 0.07], ['peak', 0.12], ['recovery', 0.07], ['peak', 0.14], ['descent', 0.15], ['close', 0.1]]
};
/** Where an activity sits in the arc: early, middle or at the peak. */
function stageOf(a) {
    if (a.impactLevel)
        return a.impactLevel === 1 ? 'warmup' : a.impactLevel === 2 ? 'build' : 'peak';
    if (a.restraint || a.category === 'touch' || a.category === 'bondage')
        return 'warmup';
    if (a.category === 'penetration')
        return 'build';
    if (['electricity', 'wax', 'hair-pulling', 'biting', 'scratching'].includes(a.id))
        return 'peak';
    return 'build';
}
/** Insertables never go in at a peak. */
const INSERTABLE_STAGE = (a) => (a.category === 'penetration' ? 'build' : null);
const minutesOf = (total, share) => Math.max(2, Math.round(total * share));
export function design(shape, req, ctx) {
    const now = new Date().toISOString();
    const gearPlan = (req.impactPlan ?? []).filter((g) => activityOf(ctx, g.activityId) && !ctx.optedOutGear.includes(g.gearId));
    const picked = req.picks
        .map((p) => ({ pick: p, a: activityOf(ctx, p.activityId) }))
        .filter((x) => Boolean(x.a))
        // A planned gear order takes over the impact picks.
        .filter((x) => !(gearPlan.length && x.a.category === 'impact'));
    const byStage = (stage) => picked.filter((x) => stageOf(x.a) === stage);
    const strongest = Math.max(5, ...picked.map((x) => x.pick.intensity));
    // Gear: when chosen, each step gets a piece that suits its kind of play.
    const kindFor = { impact: 'impact', bondage: 'bondage', sensation: 'sensation', penetration: 'insertable' };
    const gear = ctx.gear.filter((g) => req.useSpecificGear && req.gearIds.includes(g.id) && !ctx.optedOutGear.includes(g.id));
    const liked = ctx.intake?.detailed?.impact.feel ?? [];
    const gearFor = (a) => {
        const fits = gear.filter((g) => g.types.includes(kindFor[a.category] ?? 'more'));
        return (fits.find((g) => !liked.length || g.feel.some((f) => liked.includes(f))) ?? fits[0])?.id ?? null;
    };
    const placed = new Set();
    const stepFor = (x, stage) => {
        placed.add(x.a.id);
        return newStep({ activityId: x.a.id, do: doText(x.a.category, x.a.label, stage, Boolean(x.a.restraint)), say: '', gearId: gearFor(x.a), surprise: x.pick.surprise });
    };
    const fill = (stage, max) => {
        const pool = [...byStage(stage), ...(stage === 'peak' && !byStage('peak').length ? byStage('build') : [])];
        const fresh = pool.filter((x) => !placed.has(x.a.id));
        return [...fresh, ...pool.filter((x) => placed.has(x.a.id))].slice(0, max);
    };
    // A beat goes as far as its strongest pick asks, but never past a hard
    // limit: the Top's range for any activity in it.
    const capFor = (steps, wanted) => {
        let hard = 10;
        let asked = 0;
        for (const s of steps) {
            const a = activityOf(ctx, s.activityId);
            if (!a)
                continue;
            const pick = req.picks.find((p) => p.activityId === a.id);
            asked = Math.max(asked, pick ? Math.max(pick.intensity, 3) : 0);
            const range = ctx.top.offerings.categories[a.category];
            if (range?.on)
                hard = Math.min(hard, range.max);
        }
        return Math.max(1, Math.min(wanted, hard, asked || wanted));
    };
    const plan = plans[shape];
    const peaks = plan.filter(([t]) => t === 'peak').length;
    let peakNo = 0;
    const phases = plan.map(([type, share]) => {
        const total = minutesOf(req.minutes, share);
        const beats = [];
        switch (type) {
            case 'arrival':
                beats.push(newBeat({ title: fixed.arrival.title, minutes: total, intensity: 2, steps: [newStep({ do: fixed.arrival.do, say: fixed.arrival.say })] }));
                break;
            case 'build': {
                const warmSteps = fill('warmup', 2).map((x) => stepFor(x, 'warmup'));
                const warm = newBeat({ kind: 'warmup', title: fixed.warmup.title, minutes: Math.max(2, Math.round(total * 0.4)), intensity: 3, steps: warmSteps });
                if (!warmSteps.length)
                    warm.steps = [newStep({ do: 'Slow, warm contact to bring them into their body.', say: sayFor.warmup })];
                else
                    warm.steps[0].say = sayFor.warmup;
                warm.intensity = Math.min(4, capFor(warm.steps, 3));
                const buildSteps = fill('build', 2).map((x) => stepFor(x, 'build'));
                const climb = newBeat({ title: fixed.build.title, minutes: Math.max(2, total - warm.minutes), steps: buildSteps });
                if (!buildSteps.length)
                    climb.steps = fill('warmup', 2).map((x) => stepFor(x, 'build'));
                if (climb.steps.length)
                    climb.steps[0].say = sayFor.build;
                else
                    climb.steps = [newStep({ do: 'Keep building what is working, a little more each minute.', say: sayFor.build })];
                climb.intensity = Math.max(warm.intensity, capFor(climb.steps, Math.min(6, strongest - 1)));
                beats.push(warm, climb);
                break;
            }
            case 'peak': {
                peakNo += 1;
                // Later peaks go higher; the last reaches the strongest pick.
                const target = Math.max(5, strongest - (peaks - peakNo));
                const steps = fill('peak', 2).map((x) => stepFor(x, 'peak'));
                const beat = newBeat({ title: peaks > 1 ? `${fixed.peak.title} ${peakNo}` : fixed.peak.title, minutes: total, steps });
                if (!beat.steps.length)
                    beat.steps = [newStep({ do: 'Bring together what has worked best so far.' })];
                beat.steps[0].say = sayFor.peak;
                beat.intensity = capFor(beat.steps, target);
                beats.push(beat);
                break;
            }
            case 'recovery':
                beats.push(newBeat({ kind: 'recovery', title: fixed.recovery.title, minutes: total, intensity: 2, steps: [newStep({ do: fixed.recovery.do, say: fixed.recovery.say })] }));
                break;
            case 'descent':
                beats.push(newBeat({ kind: 'landing', title: fixed.descent.title, minutes: total, intensity: 3, steps: [newStep({ do: fixed.descent.do, say: fixed.descent.say })] }));
                break;
            case 'close':
                beats.push(newBeat({ kind: 'named', title: fixed.close.title, minutes: total, intensity: 1, steps: [newStep({ do: fixed.close.do, say: fixed.close.say, notes: fixed.close.notes })] }));
                break;
        }
        return { id: newId('p'), type, beats };
    });
    // The planned gear order runs from the warm-up through the builds to the
    // peaks: about a quarter warms up, a third builds, the rest peaks.
    if (gearPlan.length) {
        const builds = phases.filter((p) => p.type === 'build');
        const warm = builds[0]?.beats[0];
        const climbs = builds.flatMap((p, i) => (i === 0 ? p.beats.slice(1) : p.beats));
        const peakBeats = phases.filter((p) => p.type === 'peak').map((p) => p.beats[0]);
        const nameOf = (id) => ctx.gear.find((g) => g.id === id)?.name ?? 'the next piece';
        const put = (beat, g, stage) => {
            if (!beat)
                return;
            // Replace a placeholder step the first time real gear arrives.
            if (beat.steps.length === 1 && !beat.steps[0].activityId && !beat.steps[0].gearId)
                beat.steps = [];
            beat.steps.push(newStep({ activityId: g.activityId, gearId: g.gearId, do: doText('impact', nameOf(g.gearId), stage, false), say: beat.steps.length ? '' : sayFor[stage] }));
        };
        const nWarm = Math.max(1, Math.round(gearPlan.length * 0.25));
        const nBuild = Math.round(gearPlan.length * 0.35);
        gearPlan.slice(0, nWarm).forEach((g) => put(warm, g, 'warmup'));
        gearPlan.slice(nWarm, nWarm + nBuild).forEach((g, i) => put(climbs[i % Math.max(1, climbs.length)], g, 'build'));
        const forPeaks = gearPlan.slice(nWarm + nBuild);
        peakBeats.forEach((beat, k) => {
            const from = Math.floor((k * forPeaks.length) / peakBeats.length);
            const to = Math.floor(((k + 1) * forPeaks.length) / peakBeats.length);
            const mine = forPeaks.slice(from, to);
            // A peak with nothing new of its own repeats the next piece in line.
            (mine.length ? mine : [forPeaks[from] ?? gearPlan[gearPlan.length - 1]]).forEach((g) => put(beat, g, 'peak'));
        });
    }
    // Anything not placed yet goes to the least busy beat of its stage (early
    // touch can join the arrival), so every pick is used.
    const home = {
        warmup: phases.flatMap((p) => (p.type === 'arrival' ? p.beats : p.type === 'build' ? p.beats.slice(0, 1) : [])),
        build: phases.flatMap((p) => (p.type === 'build' ? p.beats.slice(1) : [])),
        peak: phases.flatMap((p) => (p.type === 'peak' ? p.beats : []))
    };
    for (const x of picked) {
        if (placed.has(x.a.id))
            continue;
        const stage = INSERTABLE_STAGE(x.a) ?? stageOf(x.a);
        const target = [...home[stage]].sort((m, n) => m.steps.length - n.steps.length)[0];
        if (!target)
            continue;
        const step = stepFor(x, stage);
        target.steps.push(step);
    }
    for (const p of phases)
        for (const b of p.beats)
            if (b.kind === 'regular' && p.type !== 'arrival')
                b.intensity = Math.min(b.intensity, capFor(b.steps, b.intensity));
    // Each earlier peak stays a little lighter than the one after it.
    const peakBeats = phases.filter((p) => p.type === 'peak').map((p) => p.beats[0]);
    for (let k = peakBeats.length - 2; k >= 0; k--)
        peakBeats[k].intensity = Math.max(4, Math.min(peakBeats[k].intensity, peakBeats[k + 1].intensity - 1));
    phases.push(aftercarePhase(phases, req, ctx));
    const scene = {
        v: 1,
        id: crypto.randomUUID(),
        title: req.title,
        connectionId: req.connectionId,
        partnerId: req.partnerId,
        partnerName: req.partnerName,
        role: req.role,
        date: req.date,
        startTime: req.startTime,
        minutes: req.minutes,
        location: req.location,
        isPublic: req.isPublic,
        intense: req.intense,
        intakeVersion: req.intakeVersion,
        marks: req.marks,
        useSpecificGear: req.useSpecificGear,
        gearIds: req.gearIds,
        picks: req.picks,
        notes: req.notes,
        shape,
        phases,
        overrides: req.overrides,
        kept: {},
        nextMorningCheckIn: false,
        inLibrary: false,
        createdAt: now,
        updatedAt: now
    };
    scene.nextMorningCheckIn = needsNextMorningCheckIn(scene, ctx);
    return scene;
}
function aftercarePhase(play, req, ctx) {
    const playMinutes = play.reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
    const pct = req.intense ? ctx.top.settings.intensePercent : ctx.top.settings.aftercarePercent;
    const need = aftercareMinutes(playMinutes, req.intense, pct);
    const first = Math.ceil(need * 0.4);
    const second = Math.ceil(need * 0.4);
    const third = Math.max(2, need - first - second);
    const care = ctx.intake?.aftercare;
    const style = care?.map ? aftercareStyle[quadrantOf(aftercareMap, care.map).id] : '';
    const extras = care?.extras.length ? `They asked for: ${care.extras.join(', ').toLowerCase()}.` : '';
    return {
        id: newId('p'),
        type: 'aftercare',
        beats: [
            newBeat({ kind: 'immediate', title: fixed.immediate.title, minutes: first, intensity: 1, steps: [newStep({ do: [fixed.immediate.do, style].filter(Boolean).join(' ') })] }),
            newBeat({ kind: 'settled', title: fixed.settled.title, minutes: second, intensity: 1, steps: [newStep({ do: [fixed.settled.do, extras].filter(Boolean).join(' ') })] }),
            newBeat({ kind: 'closing', title: fixed.closing.title, minutes: third, intensity: 1, steps: [newStep({ do: fixed.closing.do, say: fixed.closing.say })] })
        ]
    };
}
/** Two or three starting designs, one per arc shape. Short scenes get fewer. */
export function designOptions(req, ctx) {
    const order = shapeOrder(ctx).filter((s) => req.minutes >= (s === 'waves' ? 60 : s === 'twin' ? 40 : 0));
    return order.slice(0, 3).map((s) => design(s, req, ctx));
}
export const shapeLabel = (s) => shapes[s].label;
/** Whether the bottom answered every pick yes (anything else needs a flag or an override). */
export const isYes = (ctx, id) => choiceOf(ctx, id) === 'yes';
