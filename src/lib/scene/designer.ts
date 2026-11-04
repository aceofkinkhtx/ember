import { aftercareMap, quadrantOf } from '../../content/intake';
import { aftercareStyle, doText, fixed, sayFor, shapeForFlow, shapes, type Stage } from '../../content/sceneText';
import { isOffered } from '../../content/topSetup';
import { aftercareMinutes } from '../../content/topDefaults';
import type { PhaseType } from '../../content/phases';
import type { Activity } from '../../data/activities';
import { newBeat, newId, newStep, type ArcShape, type Beat, type Phase, type Override, type Pick, type Scene, type Step } from './model';
import { activityOf, choiceOf, needsNextMorningCheckIn, type RuleContext } from './rules';

// The auto-designer: two or three starting designs built only from the
// bottom's yes items that the Top offers. Each option is a different arc shape;
// the one that fits the bottom's Flow word comes first. Every design it makes
// passes all block rules (tested), and the Top edits from there.

/** Yes items the Top offers, with a starting intensity for each. Edge play and negotiated-only acts are never suggested. */
export function suggestedPicks(ctx: RuleContext): Pick[] {
  const answers = ctx.intake?.detailed?.answers ?? {};
  const picks: Pick[] = [];
  for (const [id, answer] of Object.entries(answers)) {
    if (answer.choice !== 'yes') continue;
    const a = activityOf(ctx, id);
    if (!a || a.edge || a.negotiatedOnly) continue;
    if (!a.custom && !isOffered(ctx.top, a, ctx.studio)) continue;
    const range = ctx.top.offerings.categories[a.category];
    // Up to how far the Top goes, or less if the bottom said so.
    const max = range?.max ?? 6;
    picks.push({ activityId: id, intensity: Math.min(max, answer.intensity ?? max), surprise: false });
  }
  return picks;
}

/** The shapes to offer, the one that fits their Flow word first. */
export function shapeOrder(ctx: RuleContext): ArcShape[] {
  const flow = ctx.intake?.quick?.words.flow ?? [];
  const preferred = flow.map((w) => shapeForFlow[w]).find(Boolean);
  const all: ArcShape[] = ['climb', 'twin', 'waves'];
  return preferred ? [preferred, ...all.filter((s) => s !== preferred)] : all;
}

export interface DesignRequest {
  title: string;
  connectionId: string | null;
  partnerId: string | null;
  partnerName: string;
  role: 'top' | 'bottom';
  date: string;
  startTime: string;
  minutes: number;
  location: string;
  isPublic: boolean;
  intense: boolean;
  intakeVersion: number | null;
  marks: string;
  useSpecificGear: boolean;
  gearIds: string[];
  picks: Pick[];
  /** Overrides confirmed while choosing picks. */
  overrides: Override[];
  notes: string;
}

/** How each shape splits play time, in order. */
const plans: Record<ArcShape, [PhaseType, number][]> = {
  climb: [['arrival', 0.1], ['build', 0.4], ['peak', 0.25], ['descent', 0.15], ['close', 0.1]],
  twin: [['arrival', 0.08], ['build', 0.22], ['peak', 0.12], ['recovery', 0.08], ['peak', 0.25], ['descent', 0.15], ['close', 0.1]],
  waves: [['arrival', 0.08], ['build', 0.17], ['peak', 0.1], ['recovery', 0.07], ['peak', 0.12], ['recovery', 0.07], ['peak', 0.14], ['descent', 0.15], ['close', 0.1]]
};

/** Where an activity sits in the arc: early, middle or at the peak. */
function stageOf(a: Activity): Stage {
  if (a.impactLevel) return a.impactLevel === 1 ? 'warmup' : a.impactLevel === 2 ? 'build' : 'peak';
  if (a.restraint || a.category === 'touch' || a.category === 'bondage') return 'warmup';
  if (a.category === 'penetration') return 'build';
  if (['electricity', 'wax', 'hair-pulling', 'biting', 'scratching'].includes(a.id)) return 'peak';
  return 'build';
}

/** Insertables never go in at a peak. */
const INSERTABLE_STAGE = (a: Activity): Stage | null => (a.category === 'penetration' ? 'build' : null);

const minutesOf = (total: number, share: number) => Math.max(2, Math.round(total * share));

export function design(shape: ArcShape, req: DesignRequest, ctx: RuleContext): Scene {
  const now = new Date().toISOString();
  const picked = req.picks
    .map((p) => ({ pick: p, a: activityOf(ctx, p.activityId) }))
    .filter((x): x is { pick: Pick; a: Activity } => Boolean(x.a));
  const byStage = (stage: Stage) => picked.filter((x) => stageOf(x.a) === stage);
  const strongest = Math.max(5, ...picked.map((x) => x.pick.intensity));

  // Gear: when chosen, each step gets a piece that suits its kind of play.
  const kindFor: Record<string, string> = { impact: 'impact', bondage: 'bondage', sensation: 'sensation', penetration: 'insertable' };
  const gear = ctx.gear.filter((g) => req.useSpecificGear && req.gearIds.includes(g.id) && !ctx.optedOutGear.includes(g.id));
  const liked = ctx.intake?.detailed?.impact.feel ?? [];
  const gearFor = (a: Activity) => {
    const fits = gear.filter((g) => g.types.includes(kindFor[a.category] ?? 'more'));
    return (fits.find((g) => !liked.length || g.feel.some((f) => liked.includes(f))) ?? fits[0])?.id ?? null;
  };

  const placed = new Set<string>();
  const stepFor = (x: { pick: Pick; a: Activity }, stage: Stage): Step => {
    placed.add(x.a.id);
    return newStep({ activityId: x.a.id, do: doText(x.a.category, x.a.label, stage, Boolean(x.a.restraint)), say: '', gearId: gearFor(x.a), surprise: x.pick.surprise });
  };
  const fill = (stage: Stage, max: number) => {
    const pool = [...byStage(stage), ...(stage === 'peak' && !byStage('peak').length ? byStage('build') : [])];
    const fresh = pool.filter((x) => !placed.has(x.a.id));
    return [...fresh, ...pool.filter((x) => placed.has(x.a.id))].slice(0, max);
  };
  // A beat goes as far as its strongest pick asks, but never past a hard
  // limit: the Top's range for any activity in it.
  const capFor = (steps: Step[], wanted: number) => {
    let hard = 10;
    let asked = 0;
    for (const s of steps) {
      const a = activityOf(ctx, s.activityId);
      if (!a) continue;
      const pick = req.picks.find((p) => p.activityId === a.id);
      asked = Math.max(asked, pick ? Math.max(pick.intensity, 3) : 0);
      const range = ctx.top.offerings.categories[a.category];
      if (range?.on) hard = Math.min(hard, range.max);
    }
    return Math.max(1, Math.min(wanted, hard, asked || wanted));
  };

  const plan = plans[shape];
  const peaks = plan.filter(([t]) => t === 'peak').length;
  let peakNo = 0;
  const phases: Phase[] = plan.map(([type, share]) => {
    const total = minutesOf(req.minutes, share);
    const beats: Beat[] = [];
    switch (type) {
      case 'arrival':
        beats.push(newBeat({ title: fixed.arrival.title, minutes: total, intensity: 2, steps: [newStep({ do: fixed.arrival.do, say: fixed.arrival.say })] }));
        break;
      case 'build': {
        const warmSteps = fill('warmup', 2).map((x) => stepFor(x, 'warmup'));
        const warm = newBeat({ kind: 'warmup', title: fixed.warmup.title, minutes: Math.max(2, Math.round(total * 0.4)), intensity: 3, steps: warmSteps });
        if (!warmSteps.length) warm.steps = [newStep({ do: 'Slow, warm contact to bring them into their body.', say: sayFor.warmup })];
        else warm.steps[0].say = sayFor.warmup;
        warm.intensity = Math.min(4, capFor(warm.steps, 3));
        const buildSteps = fill('build', 2).map((x) => stepFor(x, 'build'));
        const climb = newBeat({ title: fixed.build.title, minutes: Math.max(2, total - warm.minutes), steps: buildSteps });
        if (!buildSteps.length) climb.steps = fill('warmup', 2).map((x) => stepFor(x, 'build'));
        if (climb.steps.length) climb.steps[0].say = sayFor.build;
        else climb.steps = [newStep({ do: 'Keep building what is working, a little more each minute.', say: sayFor.build })];
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
        if (!beat.steps.length) beat.steps = [newStep({ do: 'Bring together what has worked best so far.' })];
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

  // Anything not placed yet goes to the least busy beat of its stage (early
  // touch can join the arrival), so every pick is used.
  const home: Record<Stage, Beat[]> = {
    warmup: phases.flatMap((p) => (p.type === 'arrival' ? p.beats : p.type === 'build' ? p.beats.slice(0, 1) : [])),
    build: phases.flatMap((p) => (p.type === 'build' ? p.beats.slice(1) : [])),
    peak: phases.flatMap((p) => (p.type === 'peak' ? p.beats : []))
  };
  for (const x of picked) {
    if (placed.has(x.a.id)) continue;
    const stage = INSERTABLE_STAGE(x.a) ?? stageOf(x.a);
    const target = [...home[stage]].sort((m, n) => m.steps.length - n.steps.length)[0];
    if (!target) continue;
    const step = stepFor(x, stage);
    target.steps.push(step);
  }
  for (const p of phases) for (const b of p.beats) if (b.kind === 'regular' && p.type !== 'arrival') b.intensity = Math.min(b.intensity, capFor(b.steps, b.intensity));
  // Each earlier peak stays a little lighter than the one after it.
  const peakBeats = phases.filter((p) => p.type === 'peak').map((p) => p.beats[0]);
  for (let k = peakBeats.length - 2; k >= 0; k--) peakBeats[k].intensity = Math.max(4, Math.min(peakBeats[k].intensity, peakBeats[k + 1].intensity - 1));

  phases.push(aftercarePhase(phases, req, ctx));

  const scene: Scene = {
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

function aftercarePhase(play: Phase[], req: DesignRequest, ctx: RuleContext): Phase {
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
export function designOptions(req: DesignRequest, ctx: RuleContext): Scene[] {
  const order = shapeOrder(ctx).filter((s) => req.minutes >= (s === 'waves' ? 60 : s === 'twin' ? 40 : 0));
  return order.slice(0, 3).map((s) => design(s, req, ctx));
}

export const shapeLabel = (s: ArcShape) => shapes[s].label;

/** Whether the bottom answered every pick yes (anything else needs a flag or an override). */
export const isYes = (ctx: RuleContext, id: string) => choiceOf(ctx, id) === 'yes';
