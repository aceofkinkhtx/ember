import { aftercareMinutes } from '../../content/topDefaults';
import type { Scene } from './model';
import { activityOf, confirmationsFor, needsNextMorningCheckIn, type RuleContext } from './rules';

// Hands a design to a new owner or partner: a Top accepting a bottom's
// request, or a library design reused with someone else. Overrides and kept
// warnings belonged to the old pairing, so they don't carry over. Anything the
// new pairing's rules would block, or that needs a fresh confirmation, comes
// out and is listed, so the designer can add it back deliberately.

export interface Target {
  connectionId: string;
  partnerId: string;
  partnerName: string;
  role: 'top' | 'bottom';
  intakeVersion: number | null;
}

export interface Adapted {
  scene: Scene;
  /** Plain lines saying what was taken out or changed. */
  changes: string[];
}

export function adaptScene(source: Scene, ctx: RuleContext, target: Target, patch: Partial<Scene> = {}): Adapted {
  const changes: string[] = [];
  const now = new Date().toISOString();
  const scene: Scene = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    ...target,
    overrides: [],
    kept: {},
    request: undefined,
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
        if (!a) return true;
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
  if (needsNextMorningCheckIn(scene, ctx)) scene.nextMorningCheckIn = true;
  return { scene, changes };
}
