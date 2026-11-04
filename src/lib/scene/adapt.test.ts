import { emptyTopSetup } from '../../content/topSetup';
import { emptyDetailed, emptyIntake, type Intake } from '../intake';
import { adaptScene } from './adapt';
import { design, suggestedPicks, type DesignRequest } from './designer';
import { blocks, validate, type RuleContext } from './rules';

// Reusing a design with someone else, or accepting a partner's request, never
// carries over something the new pairing's rules would block.

function intake(answers: Record<string, 'yes' | 'maybe' | 'no'>): Intake {
  const i = emptyIntake();
  i.detailed = emptyDetailed();
  for (const [id, choice] of Object.entries(answers)) i.detailed.answers[id] = { choice };
  return i;
}

function context(answers: Record<string, 'yes' | 'maybe' | 'no'>, patch: Partial<RuleContext> = {}): RuleContext {
  const top = emptyTopSetup();
  for (const c of ['impact', 'bondage', 'sensation', 'touch', 'penetration'] as const) top.offerings.categories[c] = { on: true, min: 1, max: 8 };
  return { intake: intake(answers), top, studio: false, optedOutGear: [], gear: [], ...patch };
}

const gear = [{ id: 'g1', name: 'Suede flogger', feel: ['thuddy' as const], types: ['impact'] }];

function original() {
  const ctx = context({ 'bare-hand': 'yes', flogger: 'yes', biting: 'yes', wax: 'yes', cuddling: 'yes' }, { gear });
  const req: DesignRequest = {
    title: 'Sunday',
    connectionId: 'c1',
    partnerId: 'u1',
    partnerName: 'Wren',
    role: 'top',
    date: '2026-11-08',
    startTime: '19:00',
    minutes: 60,
    location: '',
    isPublic: false,
    intense: false,
    intakeVersion: 2,
    marks: 'day',
    useSpecificGear: true,
    gearIds: ['g1'],
    picks: suggestedPicks(ctx),
    overrides: [],
    notes: ''
  };
  const scene = design('climb', req, ctx);
  scene.kept = { 'maybe:x:wax': { reason: 'Talked with Wren', at: '2026-11-01' } };
  return scene;
}

const target = { connectionId: 'c2', partnerId: 'u2', partnerName: 'Moss', role: 'top' as const, intakeVersion: 5 };

describe('handing a design to a new pairing', () => {
  it("takes out the new partner's no items and gear kept out of scenes with them, and says so", () => {
    const ctx = context({ 'bare-hand': 'yes', flogger: 'yes', biting: 'no', wax: 'yes', cuddling: 'yes' }, { gear, optedOutGear: ['g1'] });
    const { scene, changes } = adaptScene(original(), ctx, target);
    const steps = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps));
    expect(steps.some((s) => s.activityId === 'biting')).toBe(false);
    expect(steps.some((s) => s.gearId === 'g1')).toBe(false);
    expect(changes.join(' ')).toMatch(/Biting/);
    expect(changes.join(' ')).toMatch(/kept out of scenes with Moss/);
    expect(blocks(validate(scene, ctx))).toEqual([]);
  });

  it('starts fresh: a new id, the new partner, and no overrides or kept warnings from before', () => {
    const before = original();
    const { scene } = adaptScene(before, context({ 'bare-hand': 'yes' }), target);
    expect(scene.id).not.toBe(before.id);
    expect(scene).toMatchObject({ connectionId: 'c2', partnerName: 'Moss', intakeVersion: 5, overrides: [], kept: {}, inLibrary: false });
  });

  it("stretches aftercare to the new designer's setting", () => {
    const ctx = context({ 'bare-hand': 'yes' });
    ctx.top.settings.aftercarePercent = 60;
    const { scene, changes } = adaptScene(original(), ctx, target);
    expect(blocks(validate(scene, ctx)).map((i) => i.rule)).not.toContain('aftercare');
    expect(changes.join(' ')).toMatch(/Aftercare is now/);
  });
});
