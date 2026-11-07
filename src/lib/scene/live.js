import { limitsOf } from '../intake';
import { beatsInOrder } from './model';
import { activityOf, choiceOf } from './rules';
/**
 * Every maybe and unanswered item in a Top's plan for a partner. The bottom
 * must say yes or no to each before the scene (Michael, Nov 6), so surprises
 * that are maybes are named too. Overrides the Top already confirmed (a no
 * they talked through, edge play, sex acts) were agreed separately.
 */
export function maybesIn(scene, ctx) {
    if (scene.role !== 'top' || !ctx.intake || (ctx.intakeOf ?? 'partner') !== 'partner')
        return [];
    const confirmed = new Set(scene.overrides.map((o) => o.activityId));
    const out = new Map();
    for (const { beat } of beatsInOrder(scene))
        for (const step of beat.steps) {
            const id = step.activityId;
            if (!id || out.has(id) || confirmed.has(id))
                continue;
            const choice = choiceOf(ctx, id);
            if (choice === 'maybe' || choice === null)
                out.set(id, { activityId: id, label: activityOf(ctx, id)?.label ?? id, choice: choice ?? 'unanswered' });
        }
    return [...out.values()];
}
/** Takes activities out of the plan, step by step; beats stay. */
export function removeActivities(scene, ids) {
    if (!ids.length)
        return scene;
    const gone = new Set(ids);
    return { ...scene, phases: scene.phases.map((p) => ({ ...p, beats: p.beats.map((b) => ({ ...b, steps: b.steps.filter((s) => !s.activityId || !gone.has(s.activityId)) })) })) };
}
export const readinessIngredients = ['Curiosity', 'Choice', 'Desire', 'Trust', 'Safety', 'Room to change my mind'];
export function emptyBottomCheck() {
    return {
        feeling: 0,
        finalNegotiation: false,
        excitement: 0,
        body: 0,
        bodyNote: '',
        emotion: 0,
        emotionNote: '',
        anythingNew: false,
        newNote: '',
        substanceToday: false,
        readiness: [],
        maybes: {},
        answeredAt: ''
    };
}
/** What's still missing before the bottom can send their part. */
export function bottomCheckMissing(c, maybes) {
    const missing = [];
    if (!c.feeling || !c.excitement || !c.body || !c.emotion)
        missing.push('the sliders');
    if (!c.substanceToday)
        missing.push('the substance agreement for today');
    const unanswered = maybes.filter((m) => !c.maybes[m.activityId]);
    if (unanswered.length)
        missing.push(unanswered.length === 1 ? 'one maybe' : `${unanswered.length} maybes`);
    return missing;
}
export const safetyKit = ['Safety shears', 'Water', 'First aid kit', 'Phone charged and nearby'];
export const spaceSet = ['Phones silenced', 'Lighting set', 'Music ready', 'Supplies laid out'];
/** Said back to each other, aloud, with a tick for each. */
export function aloudList(scene, intake) {
    const s = intake?.essentials.signals;
    const words = s ? [s.green, s.yellow, s.red].filter(Boolean).join(', ') : '';
    const sign = s?.handSign ? `, and the hand sign: ${s.handSign}` : '';
    const honorific = [...(intake?.essentials.honorifics ?? []), intake?.essentials.honorificCustom ?? ''].filter(Boolean);
    return [
        { id: 'signals', text: words ? `Signals said back to each other: ${words}${sign}.` : 'Signals said back to each other, and the hand sign.' },
        { id: 'honorific', text: honorific.length ? `Honorific for this scene: ${honorific.join(' or ')}.` : 'Honorific, if you use one.' },
        { id: 'others', text: scene.isPublic ? 'Consent to anyone else present, watching or joining.' : 'Anyone else present, watching or joining: none, or agreed.' },
        { id: 'marks', text: `Marks for this scene: ${marksText[scene.marks] ?? 'agreed together'}.` }
    ];
}
const marksText = { none: 'none', day: 'gone in a day', week: 'up to a week', open: 'open' };
/** The partner's care details, copied into the snapshot (the same lists as the limit strip). */
export function careInfo(intake) {
    const e = intake?.essentials;
    const listed = intake ? limitsOf(intake) : { hard: [], soft: [] };
    const hard = [...listed.hard, e?.limits?.hard.trim() ?? '', intake?.detailed?.limits.hardExtra.trim() ?? ''].filter(Boolean);
    const soft = [...listed.soft, e?.limits?.soft.trim() ?? ''].filter(Boolean);
    return {
        signals: e?.signals ?? null,
        overwhelm: [...(e?.overwhelm.chips ?? []), e?.overwhelm.notes.trim() ?? ''].filter(Boolean),
        aftercare: [...(intake?.aftercare?.extras ?? [])],
        emergency: e?.emergency ?? null,
        limits: { hard, soft },
        body: [e?.body.notes.trim(), e?.body.allergies.trim() ? `Allergies: ${e.body.allergies.trim()}` : ''].filter(Boolean).join(' ')
    };
}
const ms = (iso) => new Date(iso).getTime();
/** Time on the scene clock, leaving out pauses and red. */
export function elapsedMs(live, now) {
    const until = live.pausedAt ? ms(live.pausedAt) : live.endedAt ? ms(live.endedAt) : now;
    return Math.max(0, until - ms(live.startedAt) - live.pausedMs);
}
/** Whether a beat binds someone (cuffs, rope, a cross), not a blindfold or a collar. */
export function isBondage(ctx, beat) {
    return beat.steps.some((s) => activityOf(ctx, s.activityId)?.restraint === true);
}
export function startLive(scene, ctx, snapshot, now) {
    const first = beatsInOrder(scene)[0];
    return {
        snapshot,
        startedAt: now,
        beat: 0,
        beatAt: 0,
        pausedAt: null,
        pausedMs: 0,
        red: null,
        restraintAt: first && isBondage(ctx, first.beat) ? 0 : null,
        circulationAt: null,
        log: [],
        endedAt: null
    };
}
/** Time in the current beat. */
export const beatElapsedMs = (live, now) => Math.max(0, elapsedMs(live, now) - live.beatAt);
export function pause(live, now) {
    return live.pausedAt ? live : { ...live, pausedAt: now };
}
/** Back to the scene after a pause, or after red once both have agreed to go on. */
export function resume(live, now) {
    if (!live.pausedAt)
        return { ...live, red: null };
    return { ...live, pausedAt: null, red: null, pausedMs: live.pausedMs + Math.max(0, ms(now) - ms(live.pausedAt)) };
}
/** Red stops every timer and is logged. */
export function callRed(live, now, byThem = false) {
    return { ...pause(live, now), red: now, log: [...live.log, { at: now, kind: byThem ? 'their-red' : 'red' }] };
}
/** Moves the guide to a beat; a run of restraint beats keeps one restraint clock. */
export function goToBeat(scene, ctx, live, index, now) {
    const all = beatsInOrder(scene);
    const i = Math.max(0, Math.min(all.length - 1, index));
    const at = elapsedMs(live, now);
    const bound = isBondage(ctx, all[i].beat);
    const stillBound = bound && live.restraintAt !== null && Math.abs(i - live.beat) === 1;
    return {
        ...live,
        beat: i,
        beatAt: at,
        restraintAt: bound ? (stillBound ? live.restraintAt : at) : null,
        circulationAt: stillBound ? live.circulationAt : null
    };
}
export function logMoment(live, kind, now, text) {
    return { ...live, log: [...live.log, text ? { at: now, kind, text } : { at: now, kind }] };
}
export function checkCirculation(live, now) {
    return { ...logMoment(live, 'circulation', new Date(now).toISOString()), circulationAt: elapsedMs(live, now) };
}
/** Minutes between circulation checks while someone is restrained. */
export const CIRCULATION_EVERY = 10;
/** Restraint time, and whether a circulation check is due. Null when no one is restrained. */
export function restraint(live, now) {
    if (live.restraintAt === null)
        return null;
    const at = elapsedMs(live, now);
    const since = at - Math.max(live.restraintAt, live.circulationAt ?? live.restraintAt);
    return { ms: at - live.restraintAt, checkDue: since >= CIRCULATION_EVERY * 60000 };
}
/** The beat the guide is on, with its phase. */
export function currentBeat(scene, live) {
    const all = beatsInOrder(scene);
    return all[Math.max(0, Math.min(all.length - 1, live.beat))];
}
export function liveShare(l, scene) {
    const all = scene ? beatsInOrder(scene) : [];
    const beatStart = all.slice(0, l.beat).reduce((n, b) => n + b.beat.minutes, 0);
    return { startedAt: l.startedAt, pausedAt: l.pausedAt, pausedMs: l.pausedMs, red: l.red, endedAt: l.endedAt, beatStart, beatMinutes: all[l.beat]?.beat.minutes, beatAt: l.beatAt };
}
/** Where the scene is, as a share of its planned minutes, for the bottom's moving wave. */
export function progressShare(totalMinutes, live, now) {
    if (totalMinutes <= 0)
        return 0;
    if (live.endedAt)
        return 1;
    const clockMin = elapsedMs(live, now) / 60000;
    // Follow the beat the guide is on; within it, the clock, up to the beat's end.
    const at = live.beatStart === undefined ? clockMin : live.beatStart + Math.min(live.beatMinutes ?? 0, clockMin - (live.beatAt ?? 0) / 60000);
    return Math.max(0, Math.min(1, at / totalMinutes));
}
export function clock(total) {
    const s = Math.floor(total / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
