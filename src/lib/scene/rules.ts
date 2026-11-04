import { bodyAreas } from '../../content/intake';
import { allTopActivities, type TopSetup } from '../../content/topSetup';
import { aftercareMinutes } from '../../content/topDefaults';
import { activities, type Activity, type Feel } from '../../data/activities';
import type { Choice, Intake } from '../intake';
import { beatsInOrder, type Beat, type Flag, type Kept, type Phase, type Scene } from './model';

// The rulebook (intake-and-data-model.md, "Design rules"). One validator
// checks every design, automatic or edited by hand. Block rules refuse a
// change with a one-line reason; warn rules can be kept with a reason. Some
// safety pieces (trigger warnings, the watch list, crying guidance) are worked
// out from the intake every time rather than stored, so no edit can remove them.

export interface GearInfo {
  id: string;
  name: string;
  feel: Feel[];
  /** Kinds of play: impact, sensation, insertable, bondage, more. */
  types: string[];
}

export interface RuleContext {
  /** The bottom's intake as shared with the designer; null if none yet. */
  intake: Intake | null;
  /** The Top's setup: offerings, ranges and settings. */
  top: TopSetup;
  studio: boolean;
  /** Gear kept out of scenes with this person. */
  optedOutGear: string[];
  gear: GearInfo[];
}

export type RuleId =
  // Block
  | 'arc'
  | 'arc-order'
  | 'landing'
  | 'warmup'
  | 'recovery'
  | 'kidneys'
  | 'marks'
  | 'limits'
  | 'opted-out'
  | 'edge'
  | 'negotiated'
  | 'aftercare'
  | 'check-in'
  // Warn
  | 'close-named'
  | 'close-order'
  | 'impact-order'
  | 'build-drop'
  | 'first-peak'
  | 'feel'
  | 'insertable-peak'
  | 'maybe'
  | 'unanswered'
  | 'top-range'
  | 'injury';

export interface Issue {
  key: string;
  rule: RuleId;
  level: 'block' | 'warn';
  /** One plain line. */
  message: string;
  beatId?: string;
  activityId?: string;
  /** For warn rules the Top chose to keep. */
  kept?: Kept;
}

export const blocks = (issues: Issue[]) => issues.filter((i) => i.level === 'block');
export const warnings = (issues: Issue[]) => issues.filter((i) => i.level === 'warn');

// Lookups ------------------------------------------------------------------------

export function activityOf(ctx: RuleContext, id: string | null): Activity | undefined {
  if (!id) return undefined;
  return allTopActivities(ctx.top.offerings).find((a) => a.id === id) ?? ctx.intake?.detailed?.custom.find((a) => a.id === id) ?? activities.find((a) => a.id === id);
}

/** The bottom's answer for an activity; null when they didn't answer it. */
export function choiceOf(ctx: RuleContext, id: string): Choice | null {
  return ctx.intake?.detailed?.answers[id]?.choice ?? null;
}

const stepsOf = (beat: Beat) => beat.steps.filter((s) => s.activityId);

/** Plugs and other insertables: toys inside the body. */
const INSERTABLES = new Set(['toys-anus', 'toys-vagina']);

/** Impact areas mapped to the body areas people mark for injuries. */
const AREA_TO_BODY: Record<string, string> = {
  butt: 'butt',
  'back-thigh': 'thighs',
  'front-thigh': 'thighs',
  'inner-thigh': 'thighs',
  forearms: 'arms',
  'upper-arm': 'arms',
  chest: 'chest',
  'upper-back': 'upper-back',
  calves: 'calves',
  soles: 'ankles-feet',
  face: 'head',
  genitals: 'genitals'
};

// Next-morning check-in ----------------------------------------------------------

/** Subspace or cathartic release is likely: a very intense beat, or a bottom who seeks release or losing themselves. */
export function needsNextMorningCheckIn(scene: Scene, ctx: RuleContext): boolean {
  if (scene.phases.some((p) => p.beats.some((b) => b.intensity >= 8))) return true;
  const decoder = Object.values(ctx.intake?.quick?.decoder ?? {}).flat();
  return decoder.includes('release') || decoder.includes('sensation');
}

// Automatic flags ----------------------------------------------------------------

export const CORE_WATCH = 'Vocal to silent, breath changes, rigid body, glassy or absent eyes, crying (release or distress), panic.';
export const CRYING_GUIDANCE = 'Crying is not a stop unless they use a signal. Stay close, stay quiet, let them lead.';

type BeatTest = (beat: Beat, phase: Phase, ctx: RuleContext) => boolean;

const usesActivity =
  (test: (a: Activity) => boolean): BeatTest =>
  (beat, _phase, ctx) =>
    stepsOf(beat).some((s) => {
      const a = activityOf(ctx, s.activityId);
      return a ? test(a) : false;
    });

const inPhase =
  (...types: Phase['type'][]): BeatTest =>
  (_beat, phase) =>
    types.includes(phase.type);

/** Where each known trigger is most likely to surface. */
const TRIGGER_PLACES: Record<string, BeatTest> = {
  'Being called certain names': inPhase('build', 'peak'),
  'Hands near my throat': usesActivity((a) => ['choking', 'collar-lead', 'gag'].includes(a.id)),
  'Being held down': usesActivity((a) => Boolean(a.restraint)),
  'Raised voices': inPhase('peak'),
  'Being ignored': (beat, phase, ctx) =>
    phase.type === 'recovery' || usesActivity((a) => ['sensory-deprivation', 'mental-bondage'].includes(a.id))(beat, phase, ctx),
  Darkness: usesActivity((a) => ['blindfold', 'sensory-deprivation', 'mummification'].includes(a.id)),
  'Certain smells': usesActivity((a) => a.id === 'wax')
};

/** Flags worked out from the intake for every beat: trigger warnings, watch list, crying guidance. */
export function automaticFlags(scene: Scene, ctx: RuleContext): Map<string, Flag[]> {
  const out = new Map<string, Flag[]>();
  const triggers = ctx.intake?.essentials.triggers;
  for (const phase of scene.phases) {
    for (const beat of phase.beats) {
      const flags: Flag[] = [];
      for (const chip of triggers?.chips ?? []) {
        const place = TRIGGER_PLACES[chip] ?? inPhase('peak');
        if (place(beat, phase, ctx)) flags.push({ kind: 'warning', text: `Trigger: ${chip}. Their plan if overwhelmed is in the red screen.` });
      }
      if (triggers?.notes.trim() && phase.type === 'peak') flags.push({ kind: 'warning', text: `Trigger noted: ${triggers.notes.trim()}` });
      if (phase.type === 'build' || phase.type === 'peak') flags.push({ kind: 'watch', text: CORE_WATCH });
      if (phase.type === 'peak') flags.push({ kind: 'info', text: CRYING_GUIDANCE });
      if (flags.length) out.set(beat.id, flags);
    }
  }
  return out;
}

// The validator ------------------------------------------------------------------

export function validate(scene: Scene, ctx: RuleContext): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: RuleId, level: Issue['level'], message: string, where: { beatId?: string; activityId?: string } = {}) => {
    const key = `${rule}:${where.beatId ?? ''}:${where.activityId ?? ''}`;
    if (issues.some((i) => i.key === key)) return;
    issues.push({ key, rule, level, message, ...where, kept: level === 'warn' ? scene.kept[key] : undefined });
  };
  const types = scene.phases.map((p) => p.type);
  const ordered = beatsInOrder(scene);

  // Arc
  const missing = (['arrival', 'peak', 'descent', 'close', 'aftercare'] as const).filter((t) => !types.includes(t));
  if (missing.length) add('arc', 'block', `Every scene needs ${missing.join(', ')}.`);
  if ((types.includes('aftercare') && types[types.length - 1] !== 'aftercare') || (types.includes('arrival') && types[0] !== 'arrival'))
    add('arc-order', 'block', 'Arrival comes first and aftercare comes last.');
  const closeAt = types.lastIndexOf('close');
  if (closeAt >= 0 && types[types.length - 1] === 'aftercare' && closeAt !== types.length - 2)
    add('close-order', 'warn', 'The close usually comes right before aftercare.');

  const descent = scene.phases.filter((p) => p.type === 'descent');
  if (descent.length && !descent.some((p) => p.beats.some((b) => b.steps.some((s) => s.say.trim()))))
    add('landing', 'block', 'The descent needs a spoken landing line, such as "We are coming down now."');

  const close = scene.phases.filter((p) => p.type === 'close');
  if (close.length && !close.some((p) => p.beats.some((b) => b.steps.some((s) => s.say.trim()))))
    add('close-named', 'warn', 'The close should name one specific, true thing they did.');

  // Warm-up
  const firstWarm = ordered.findIndex((x) => x.beat.kind === 'warmup');
  const tooSoon = ordered.find((x) => x.beat.intensity > 4 && (firstWarm < 0 || x.index < firstWarm));
  if (tooSoon) add('warmup', 'block', 'Nothing above intensity 4 before a warm-up beat.', { beatId: tooSoon.beat.id });

  // Peaks
  const peakIdx = types.flatMap((t, i) => (t === 'peak' ? [i] : []));
  for (let k = 1; k < peakIdx.length; k++) {
    const between = scene.phases.slice(peakIdx[k - 1] + 1, peakIdx[k]);
    const rests = between.some((p) => (p.type === 'recovery' && p.beats.length > 0) || p.beats.some((b) => b.kind === 'recovery'));
    if (!rests) add('recovery', 'block', 'Two peaks need a recovery beat between them: water, care, a check-in.', { beatId: scene.phases[peakIdx[k]].beats[0]?.id });
  }
  if (peakIdx.length > 1) {
    const [a, b] = [scene.phases[peakIdx[0]], scene.phases[peakIdx[1]]];
    const len = (p: Phase) => p.beats.reduce((n, x) => n + x.minutes, 0);
    const top = (p: Phase) => Math.max(0, ...p.beats.map((x) => x.intensity));
    if (len(a) >= len(b) || top(a) >= top(b)) add('first-peak', 'warn', 'The first peak is usually shorter and lighter than the next.', { beatId: a.beats[0]?.id });
  }

  // Intensity drops mid-build
  for (const p of scene.phases.filter((x) => x.type === 'build')) {
    for (let k = 1; k < p.beats.length; k++) {
      if (p.beats[k].intensity < p.beats[k - 1].intensity && p.beats[k].kind !== 'recovery')
        add('build-drop', 'warn', 'Intensity drops in the middle of the build.', { beatId: p.beats[k].id });
    }
  }

  // Impact escalation
  let highest = 0;
  let firstImpact = true;
  for (const { phase, beat } of ordered) {
    if (phase.type === 'recovery' || phase.type === 'descent') highest = 0;
    for (const s of stepsOf(beat)) {
      const level = activityOf(ctx, s.activityId)?.impactLevel;
      if (!level) continue;
      if ((firstImpact && level > 1) || level < highest) add('impact-order', 'warn', 'Impact usually goes bare hand, then light, then moderate, then heavy.', { beatId: beat.id });
      firstImpact = false;
      highest = Math.max(highest, level);
    }
  }

  // Areas
  const injured = new Set(ctx.intake?.essentials.body.areas ?? []);
  for (const { beat } of ordered) {
    if (beat.areas.includes('kidneys')) add('kidneys', 'block', 'The kidneys are never a target.', { beatId: beat.id });
    const hurt = beat.areas.filter((a) => injured.has(AREA_TO_BODY[a] ?? a));
    if (hurt.length) {
      const names = hurt.map((a) => bodyAreas.find((b) => b.id === (AREA_TO_BODY[a] ?? a))?.label ?? a);
      add('injury', 'warn', `They noted an injury or pain here: ${names.join(', ')}.`, { beatId: beat.id });
    }
  }

  // Marks
  for (const { beat } of ordered) {
    const levels = stepsOf(beat).map((s) => activityOf(ctx, s.activityId)?.impactLevel ?? 0);
    const impact = Math.max(0, ...levels);
    if (!impact) continue;
    if (scene.marks === 'none' && (impact >= 3 || beat.intensity > 6))
      add('marks', 'block', 'No marks was agreed: keep impact light (no canes, whips or punching, intensity 6 or less).', { beatId: beat.id });
    if (scene.marks === 'day' && impact >= 4 && beat.intensity > 7)
      add('marks', 'block', 'Marks for the day only: canes and whips stay at intensity 7 or less.', { beatId: beat.id });
  }

  // Limits, overrides and gear
  const confirmed = (id: string, kind: string) => scene.overrides.some((o) => o.activityId === id && o.kind === kind);
  const allowNo = Boolean(ctx.intake?.essentials.allowNoOverride.on);
  for (const { phase, beat } of ordered) {
    for (const s of beat.steps) {
      if (s.gearId && ctx.optedOutGear.includes(s.gearId)) add('opted-out', 'block', 'That gear is kept out of scenes with this person.', { beatId: beat.id });
      const a = activityOf(ctx, s.activityId);
      if (!a) continue;
      const where = { beatId: beat.id, activityId: a.id };
      const choice = choiceOf(ctx, a.id);
      if (choice === 'no') {
        if (!allowNo) add('limits', 'block', `They marked ${a.label} as no, and haven't allowed overrides.`, where);
        else if (!confirmed(a.id, 'no')) add('limits', 'block', `They marked ${a.label} as no. Confirm you talked and agreed first.`, where);
      } else if (choice === 'maybe') add('maybe', 'warn', `${a.label} is a maybe for them. Discussed together?`, where);
      else if (choice === null) add('unanswered', 'warn', `${a.label} isn't in their answers. Discussed together?`, where);

      if (a.edge && (!ctx.studio || !confirmed(a.id, 'edge')))
        add('edge', 'block', `${a.label} is edge play: it needs Studio mode and a confirmed negotiation.`, where);
      if (a.negotiatedOnly && (!ctx.top.settings.allowNegotiatedSex || !confirmed(a.id, 'negotiated')))
        add('negotiated', 'block', `${a.label} needs your setting turned on and a confirmed negotiation for this scene.`, where);

      const range = ctx.top.offerings.categories[a.category];
      if (range?.on && beat.intensity > range.max)
        add('top-range', 'warn', `Intensity ${beat.intensity} is above how far you go with ${a.category} (${range.max}).`, { beatId: beat.id });
      if (phase.type === 'peak' && INSERTABLES.has(a.id)) add('insertable-peak', 'warn', 'Insertables go in during a calm beat, not at a peak.', where);

      const g = s.gearId ? ctx.gear.find((x) => x.id === s.gearId) : undefined;
      const liked = ctx.intake?.detailed?.impact.feel ?? [];
      if (g && a.category === 'impact' && liked.length && g.feel.length && !g.feel.some((f) => liked.includes(f)))
        add('feel', 'warn', `${g.name} feels ${g.feel.join(' or ')}; they prefer ${liked.join(' or ')}.`, { beatId: beat.id });
    }
  }

  // Aftercare
  const after = scene.phases.filter((p) => p.type === 'aftercare');
  if (after.length) {
    const play = scene.phases.filter((p) => p.type !== 'aftercare').reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
    const pct = scene.intense ? ctx.top.settings.intensePercent : ctx.top.settings.aftercarePercent;
    const need = aftercareMinutes(play, scene.intense, pct);
    const have = after.reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0);
    if (have < need) add('aftercare', 'block', `Aftercare needs at least ${need} minutes for this scene.`);
  }

  if (needsNextMorningCheckIn(scene, ctx) && !scene.nextMorningCheckIn)
    add('check-in', 'block', 'This scene may reach subspace or release, so it needs a next-morning check-in.');

  return issues;
}

export type ChangeResult = { ok: true; issues: Issue[] } | { ok: false; reason: string };

/** Applies an edit only if it adds no broken block rule. */
export function tryChange(before: Scene, after: Scene, ctx: RuleContext): ChangeResult {
  const had = new Set(blocks(validate(before, ctx)).map((i) => i.key));
  const issues = validate(after, ctx);
  const fresh = blocks(issues).find((i) => !had.has(i.key));
  return fresh ? { ok: false, reason: fresh.message } : { ok: true, issues };
}

export interface Confirmation {
  kind: 'no' | 'edge' | 'negotiated';
  question: string;
}

/**
 * Before an activity outside the bottom's yes items goes into a scene: either
 * a reason it can't, or the questions the designer must answer yes to first.
 * Maybe and unanswered items need no question; they carry an amber flag.
 */
export function confirmationsFor(ctx: RuleContext, a: Activity): { blocked: string } | { confirm: Confirmation[] } {
  const confirm: Confirmation[] = [];
  if (choiceOf(ctx, a.id) === 'no') {
    if (!ctx.intake?.essentials.allowNoOverride.on) return { blocked: `They marked ${a.label} as no, and haven't allowed overrides.` };
    confirm.push({ kind: 'no', question: 'They marked this as no. Have you talked and agreed to include it?' });
  }
  if (a.edge) {
    if (!ctx.studio) return { blocked: `${a.label} is edge play. It needs Studio mode (Me, then Depth).` };
    confirm.push({ kind: 'edge', question: `${a.label} is edge play. Have you explicitly negotiated it with them for this scene?` });
  }
  if (a.negotiatedOnly) {
    if (!ctx.top.settings.allowNegotiatedSex) return { blocked: 'Sex acts are off in your settings.' };
    confirm.push({ kind: 'negotiated', question: `Was ${a.label.toLowerCase()} negotiated with them for this scene?` });
  }
  return { confirm };
}
