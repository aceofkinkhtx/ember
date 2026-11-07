import { limitsOf, type Intake } from '../intake';
import { beatsInOrder, type Beat, type Scene } from './model';
import { activityOf, choiceOf, type RuleContext } from './rules';

// Live Scene Mode (M6): the pre-scene check, the consent snapshot it locks,
// and the running state of a scene. Pure data and logic, no UI.

// The pre-scene check ----------------------------------------------------------

/** An activity in the plan that the bottom marked maybe or didn't answer. */
export interface MaybeItem {
  activityId: string;
  label: string;
  choice: 'maybe' | 'unanswered';
}

export type MaybeAnswer = 'yes' | 'no' | 'talk';

/**
 * Every maybe and unanswered item in a Top's plan for a partner. The bottom
 * must say yes or no to each before the scene (Michael, Nov 6), so surprises
 * that are maybes are named too. Overrides the Top already confirmed (a no
 * they talked through, edge play, sex acts) were agreed separately.
 */
export function maybesIn(scene: Scene, ctx: RuleContext): MaybeItem[] {
  if (scene.role !== 'top' || !ctx.intake || (ctx.intakeOf ?? 'partner') !== 'partner') return [];
  const confirmed = new Set(scene.overrides.map((o) => o.activityId));
  const out = new Map<string, MaybeItem>();
  for (const { beat } of beatsInOrder(scene))
    for (const step of beat.steps) {
      const id = step.activityId;
      if (!id || out.has(id) || confirmed.has(id)) continue;
      const choice = choiceOf(ctx, id);
      if (choice === 'maybe' || choice === null) out.set(id, { activityId: id, label: activityOf(ctx, id)?.label ?? id, choice: choice ?? 'unanswered' });
    }
  return [...out.values()];
}

/** Takes activities out of the plan, step by step; beats stay. */
export function removeActivities(scene: Scene, ids: string[]): Scene {
  if (!ids.length) return scene;
  const gone = new Set(ids);
  return { ...scene, phases: scene.phases.map((p) => ({ ...p, beats: p.beats.map((b) => ({ ...b, steps: b.steps.filter((s) => !s.activityId || !gone.has(s.activityId)) })) })) };
}

/** What the Top sends the bottom for the check: only the maybes, by name. */
export interface CheckAsk {
  maybes: { activityId: string; label: string }[];
  askedAt: string;
}

/** The bottom's part of the check. Scales are 1 to 5. */
export interface BottomCheck {
  feeling: number;
  finalNegotiation: boolean;
  excitement: number;
  body: number;
  bodyNote: string;
  emotion: number;
  emotionNote: string;
  anythingNew: boolean;
  newNote: string;
  substanceToday: boolean;
  /** Which ingredients of their yes are present today. */
  readiness: string[];
  maybes: Record<string, MaybeAnswer>;
  answeredAt: string;
  /** Answered on the Top's phone, handed over, rather than their own. */
  onTopPhone?: boolean;
}

export const readinessIngredients = ['Curiosity', 'Choice', 'Desire', 'Trust', 'Safety', 'Room to change my mind'];

export function emptyBottomCheck(): BottomCheck {
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
export function bottomCheckMissing(c: BottomCheck, maybes: { activityId: string }[]): string[] {
  const missing: string[] = [];
  if (!c.feeling || !c.excitement || !c.body || !c.emotion) missing.push('the sliders');
  if (!c.substanceToday) missing.push('the substance agreement for today');
  const unanswered = maybes.filter((m) => !c.maybes[m.activityId]);
  if (unanswered.length) missing.push(unanswered.length === 1 ? 'one maybe' : `${unanswered.length} maybes`);
  return missing;
}

/** The Top's part. Capacity is 1 to 5. */
export interface TopCheck {
  capacity: number;
  kit: string[];
  space: string[];
}

export const safetyKit = ['Safety shears', 'Water', 'First aid kit', 'Phone charged and nearby'];
export const spaceSet = ['Phones silenced', 'Lighting set', 'Music ready', 'Supplies laid out'];

/** Said back to each other, aloud, with a tick for each. */
export function aloudList(scene: Scene, intake: Intake | null): { id: string; text: string }[] {
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

const marksText: Record<string, string> = { none: 'none', day: 'gone in a day', week: 'up to a week', open: 'open' };

// The consent snapshot ----------------------------------------------------------

/** What the bottom shared, kept with the scene so Live Scene Mode works offline. */
export interface CareInfo {
  signals: Intake['essentials']['signals'] | null;
  overwhelm: string[];
  aftercare: string[];
  emergency: Intake['essentials']['emergency'];
  limits: { hard: string[]; soft: string[] };
  body: string;
}

/** The partner's care details, copied into the snapshot (the same lists as the limit strip). */
export function careInfo(intake: Intake | null): CareInfo {
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

/** Locked when the scene starts: who agreed to what, today. */
export interface ConsentSnapshot {
  lockedAt: string;
  intakeVersion: number | null;
  top: TopCheck;
  bottom: BottomCheck | null;
  aloud: string[];
  maybes: (MaybeItem & { answer: MaybeAnswer | null })[];
  /** Taken out because the bottom said no, or after talking. */
  removed: string[];
  care: CareInfo;
}

// The running scene -----------------------------------------------------------

export type LogKind = 'yellow' | 'highlight' | 'note' | 'red' | 'circulation' | 'their-yellow' | 'their-red';

export interface LogEntry {
  at: string;
  kind: LogKind;
  text?: string;
}

export interface LiveState {
  snapshot: ConsentSnapshot;
  startedAt: string;
  /** Which beat, in order, the guide is on, and when it began on the scene clock (ms). */
  beat: number;
  beatAt: number;
  /** While paused or red: when it began. Every timer stands still. */
  pausedAt: string | null;
  pausedMs: number;
  red: string | null;
  /** On the scene clock (ms): when restraint began, and the last circulation check. */
  restraintAt: number | null;
  circulationAt: number | null;
  log: LogEntry[];
  endedAt: string | null;
}

const ms = (iso: string) => new Date(iso).getTime();

/** Time on the scene clock, leaving out pauses and red. */
export function elapsedMs(live: Pick<LiveState, 'startedAt' | 'pausedAt' | 'pausedMs' | 'endedAt'>, now: number): number {
  const until = live.pausedAt ? ms(live.pausedAt) : live.endedAt ? ms(live.endedAt) : now;
  return Math.max(0, until - ms(live.startedAt) - live.pausedMs);
}

/** Whether a beat binds someone (cuffs, rope, a cross), not a blindfold or a collar. */
export function isBondage(ctx: RuleContext, beat: Beat): boolean {
  return beat.steps.some((s) => activityOf(ctx, s.activityId)?.restraint === true);
}

export function startLive(scene: Scene, ctx: RuleContext, snapshot: ConsentSnapshot, now: string): LiveState {
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
export const beatElapsedMs = (live: LiveState, now: number) => Math.max(0, elapsedMs(live, now) - live.beatAt);

export function pause(live: LiveState, now: string): LiveState {
  return live.pausedAt ? live : { ...live, pausedAt: now };
}

/** Back to the scene after a pause, or after red once both have agreed to go on. */
export function resume(live: LiveState, now: string): LiveState {
  if (!live.pausedAt) return { ...live, red: null };
  return { ...live, pausedAt: null, red: null, pausedMs: live.pausedMs + Math.max(0, ms(now) - ms(live.pausedAt)) };
}

/** Red stops every timer and is logged. */
export function callRed(live: LiveState, now: string, byThem = false): LiveState {
  return { ...pause(live, now), red: now, log: [...live.log, { at: now, kind: byThem ? 'their-red' : 'red' }] };
}

/** Moves the guide to a beat; a run of restraint beats keeps one restraint clock. */
export function goToBeat(scene: Scene, ctx: RuleContext, live: LiveState, index: number, now: number): LiveState {
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

export function logMoment(live: LiveState, kind: LogKind, now: string, text?: string): LiveState {
  return { ...live, log: [...live.log, text ? { at: now, kind, text } : { at: now, kind }] };
}

export function checkCirculation(live: LiveState, now: number): LiveState {
  return { ...logMoment(live, 'circulation', new Date(now).toISOString()), circulationAt: elapsedMs(live, now) };
}

/** Minutes between circulation checks while someone is restrained. */
export const CIRCULATION_EVERY = 10;

/** Restraint time, and whether a circulation check is due. Null when no one is restrained. */
export function restraint(live: LiveState, now: number): { ms: number; checkDue: boolean } | null {
  if (live.restraintAt === null) return null;
  const at = elapsedMs(live, now);
  const since = at - Math.max(live.restraintAt, live.circulationAt ?? live.restraintAt);
  return { ms: at - live.restraintAt, checkDue: since >= CIRCULATION_EVERY * 60000 };
}

/** The beat the guide is on, with its phase. */
export function currentBeat(scene: Scene, live: LiveState) {
  const all = beatsInOrder(scene);
  return all[Math.max(0, Math.min(all.length - 1, live.beat))];
}

/**
 * What the bottom's phone gets while the scene runs: the clock and where the
 * guide is on the wave (the planned minute the current beat starts, and its
 * length), never the plan.
 */
export interface LiveShare {
  startedAt: string;
  pausedAt: string | null;
  pausedMs: number;
  red: string | null;
  endedAt: string | null;
  beatStart?: number;
  beatMinutes?: number;
  beatAt?: number;
}

export function liveShare(l: LiveState, scene?: Scene): LiveShare {
  const all = scene ? beatsInOrder(scene) : [];
  const beatStart = all.slice(0, l.beat).reduce((n, b) => n + b.beat.minutes, 0);
  return { startedAt: l.startedAt, pausedAt: l.pausedAt, pausedMs: l.pausedMs, red: l.red, endedAt: l.endedAt, beatStart, beatMinutes: all[l.beat]?.beat.minutes, beatAt: l.beatAt };
}

/** Where the scene is, as a share of its planned minutes, for the bottom's moving wave. */
export function progressShare(totalMinutes: number, live: LiveShare, now: number): number {
  if (totalMinutes <= 0) return 0;
  if (live.endedAt) return 1;
  const clockMin = elapsedMs(live, now) / 60000;
  // Follow the beat the guide is on; within it, the clock, up to the beat's end.
  const at = live.beatStart === undefined ? clockMin : live.beatStart + Math.min(live.beatMinutes ?? 0, clockMin - (live.beatAt ?? 0) / 60000);
  return Math.max(0, Math.min(1, at / totalMinutes));
}

/** What the bottom's phone sends: a red or a yellow, sealed to the Top. */
export interface BottomSignal {
  red: string | null;
  yellows: string[];
}

export function clock(total: number): string {
  const s = Math.floor(total / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
