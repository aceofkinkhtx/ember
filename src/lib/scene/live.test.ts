import { emptyTopSetup } from '../../content/topSetup';
import { emptyDetailed, emptyIntake } from '../intake';
import {
  bottomCheckMissing,
  callRed,
  checkCirculation,
  elapsedMs,
  emptyBottomCheck,
  goToBeat,
  maybesIn,
  pause,
  progressShare,
  removeActivities,
  restraint,
  resume,
  startLive,
  type ConsentSnapshot
} from './live';
import { newBeat, newStep, type Scene } from './model';
import type { RuleContext } from './rules';

function setup() {
  const intake = emptyIntake();
  intake.detailed = emptyDetailed();
  intake.detailed.answers['flogger'] = { choice: 'yes' };
  intake.detailed.answers['wax'] = { choice: 'maybe' };
  intake.detailed.answers['soft-cuffs'] = { choice: 'yes' };
  const ctx: RuleContext = { intake, top: emptyTopSetup(), optedOutGear: [], gear: [] };
  const scene = {
    role: 'top',
    overrides: [],
    phases: [
      { id: 'a', type: 'arrival', beats: [newBeat({ minutes: 5, steps: [newStep({ activityId: 'soft-cuffs' })] })] },
      { id: 'p', type: 'peak', beats: [newBeat({ minutes: 10, steps: [newStep({ activityId: 'soft-cuffs' }), newStep({ activityId: 'wax', surprise: true }), newStep({ activityId: 'cuddling' })] }), newBeat({ minutes: 10, steps: [newStep({ activityId: 'flogger' })] })] }
    ]
  } as unknown as Scene;
  return { ctx, scene };
}

const snapshot = {} as ConsentSnapshot;
const T0 = Date.parse('2026-11-14T20:00:00Z');
const at = (min: number) => T0 + min * 60000;
const iso = (min: number) => new Date(at(min)).toISOString();

describe('the pre-scene check', () => {
  it('lists every maybe and unanswered item, surprises included, once each', () => {
    const { ctx, scene } = setup();
    const items = maybesIn(scene, ctx);
    expect(items.map((m) => [m.activityId, m.choice])).toEqual([
      ['wax', 'maybe'],
      ['cuddling', 'unanswered']
    ]);
  });

  it('skips items the Top already confirmed, and asks nothing of the Top’s own intake', () => {
    const { ctx, scene } = setup();
    const withOverride = { ...scene, overrides: [{ activityId: 'wax', kind: 'negotiated', confirmedAt: '' }] } as Scene;
    expect(maybesIn(withOverride, ctx).map((m) => m.activityId)).toEqual(['cuddling']);
    expect(maybesIn(scene, { ...ctx, intakeOf: 'self' })).toEqual([]);
  });

  it('takes declined items out of the plan', () => {
    const { scene } = setup();
    const left = removeActivities(scene, ['wax']).phases[1].beats[0].steps.map((s) => s.activityId);
    expect(left).toEqual(['soft-cuffs', 'cuddling']);
  });

  it('needs every maybe answered before the bottom can send it', () => {
    const c = { ...emptyBottomCheck(), feeling: 4, excitement: 4, body: 4, emotion: 4, substanceToday: true };
    expect(bottomCheckMissing(c, [{ activityId: 'wax' }])).toEqual(['one maybe']);
    expect(bottomCheckMissing({ ...c, maybes: { wax: 'no' } }, [{ activityId: 'wax' }])).toEqual([]);
  });
});

describe('the running scene', () => {
  it('stops the clock on pause and on red', () => {
    const { ctx, scene } = setup();
    let live = startLive(scene, ctx, snapshot, iso(0));
    live = pause(live, iso(5));
    expect(elapsedMs(live, at(20))).toBe(5 * 60000);
    live = resume(live, iso(10));
    expect(elapsedMs(live, at(12))).toBe(7 * 60000);
    live = callRed(live, iso(12));
    expect(live.red).not.toBeNull();
    expect(live.log.at(-1)?.kind).toBe('red');
    expect(elapsedMs(live, at(30))).toBe(7 * 60000);
  });

  it('keeps one restraint clock across restraint beats and asks for circulation checks', () => {
    const { ctx, scene } = setup();
    let live = startLive(scene, ctx, snapshot, iso(0));
    expect(restraint(live, at(1))?.ms).toBe(60000);
    live = goToBeat(scene, ctx, live, 1, at(5));
    expect(restraint(live, at(11))).toEqual({ ms: 11 * 60000, checkDue: true });
    live = checkCirculation(live, at(11));
    expect(restraint(live, at(12))?.checkDue).toBe(false);
    live = goToBeat(scene, ctx, live, 2, at(15));
    expect(restraint(live, at(16))).toBeNull();
  });

  it('shows the bottom how far along the scene is', () => {
    const share = { startedAt: iso(0), pausedAt: null, pausedMs: 0, red: null, endedAt: null };
    expect(progressShare(20, share, at(5))).toBe(0.25);
    expect(progressShare(20, share, at(40))).toBe(1);
    // After a jump to aftercare, the wave follows the guide, not the clock.
    expect(progressShare(20, { ...share, beatStart: 15, beatMinutes: 5, beatAt: 2 * 60000 }, at(3))).toBe(0.8);
  });
});
