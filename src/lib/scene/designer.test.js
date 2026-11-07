import { emptyTopSetup } from '../../content/topSetup';
import { emptyAftercare, emptyDetailed, emptyIntake } from '../intake';
import { designOptions, shapeOrder, suggestedPicks } from './designer';
import { blocks, validate } from './rules';
// The auto-designer only builds from yes items the Top offers, and every
// design it proposes passes every block rule.
function intake(answers, marks = 'week') {
    const i = emptyIntake();
    i.paths = ['detailed', 'quick'];
    i.detailed = emptyDetailed();
    i.detailed.impact.marks = marks;
    i.aftercare = { ...emptyAftercare(), extras: ['Water', 'Blanket'] };
    for (const [id, choice] of Object.entries(answers))
        i.detailed.answers[id] = { choice };
    return i;
}
function context(answers, patch = {}) {
    const top = emptyTopSetup();
    for (const c of ['impact', 'bondage', 'sensation', 'touch', 'penetration'])
        top.offerings.categories[c] = { on: true, min: 1, max: 9 };
    return { intake: intake(answers), top, studio: true, optedOutGear: [], gear: [], ...patch };
}
function request(ctx, patch = {}) {
    return {
        title: 'Saturday',
        connectionId: 'c1',
        partnerId: 'u2',
        partnerName: 'Wren',
        role: 'top',
        date: '',
        startTime: '',
        minutes: 90,
        location: '',
        isPublic: false,
        intense: false,
        intakeVersion: 3,
        marks: 'week',
        useSpecificGear: false,
        gearIds: [],
        picks: suggestedPicks(ctx),
        overrides: [],
        notes: '',
        ...patch
    };
}
const lots = {
    'bare-hand': 'yes',
    flogger: 'yes',
    paddle: 'yes',
    cane: 'yes',
    whip: 'yes',
    'soft-cuffs': 'yes',
    blindfold: 'yes',
    wax: 'yes',
    biting: 'no',
    'hair-pulling': 'maybe',
    cuddling: 'yes',
    'knife-play': 'yes',
    'giving-oral': 'yes',
    'toys-anus': 'yes'
};
describe('suggested picks', () => {
    it('use only yes items the Top offers, never edge play or negotiated acts', () => {
        const ctx = context(lots);
        const ids = suggestedPicks(ctx).map((p) => p.activityId);
        expect(ids).toContain('flogger');
        expect(ids).not.toContain('biting');
        expect(ids).not.toContain('hair-pulling');
        expect(ids).not.toContain('knife-play');
        expect(ids).not.toContain('giving-oral');
        ctx.top.offerings.categories.impact.on = false;
        expect(suggestedPicks(ctx).map((p) => p.activityId)).not.toContain('flogger');
    });
    it("start within the Top's range", () => {
        const ctx = context(lots);
        ctx.top.offerings.categories.impact = { on: true, min: 2, max: 5 };
        expect(suggestedPicks(ctx).find((p) => p.activityId === 'cane')?.intensity).toBeLessThanOrEqual(5);
    });
});
describe('design options', () => {
    it('offer three arc shapes for a longer scene, the Flow match first', () => {
        const ctx = context(lots);
        ctx.intake.quick = { words: { heat: [], hold: [], flow: ['ripple'] }, decoder: {} };
        expect(shapeOrder(ctx)[0]).toBe('waves');
        expect(designOptions(request(ctx), ctx).map((s) => s.shape)).toEqual(['waves', 'climb', 'twin']);
    });
    it('offer fewer shapes for a short scene', () => {
        const ctx = context(lots);
        expect(designOptions(request(ctx, { minutes: 30 }), ctx).map((s) => s.shape)).toEqual(['climb']);
    });
    it.each([
        ['many picks, open marks', lots, 'week', false, 90],
        ['many picks, no marks', lots, 'none', false, 90],
        ['many picks, marks for the day, intense', lots, 'day', true, 120],
        ['only touch', { cuddling: 'yes', 'body-kissing': 'yes' }, 'none', false, 45],
        ['nothing answered yet', {}, 'none', false, 60]
    ])('pass every block rule: %s', (_name, answers, marks, intense, minutes) => {
        const ctx = context(answers);
        for (const scene of designOptions(request(ctx, { marks, intense, minutes }), ctx)) {
            expect(blocks(validate(scene, ctx)).map((i) => i.message)).toEqual([]);
        }
    });
    it('use every pick and keep surprises', () => {
        const ctx = context(lots);
        const picks = suggestedPicks(ctx).map((p) => (p.activityId === 'wax' ? { ...p, surprise: true } : p));
        for (const scene of designOptions(request(ctx, { picks }), ctx)) {
            const steps = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps));
            for (const p of picks)
                expect(steps.some((s) => s.activityId === p.activityId)).toBe(true);
            expect(steps.find((s) => s.activityId === 'wax')?.surprise).toBe(true);
        }
    });
    it('keep every implement whatever the marks setting', () => {
        const ctx = context(lots);
        const [scene] = designOptions(request(ctx, { marks: 'none' }), ctx);
        const used = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps.map((s) => s.activityId)));
        expect(used).toContain('cane');
        expect(scene.marks).toBe('none');
    });
    it('give gear to matching steps, never gear opted out for this person', () => {
        const gear = [
            { id: 'g1', name: 'Suede flogger', feel: ['thuddy'], types: ['impact'] },
            { id: 'g2', name: 'Rattan cane', feel: ['stingy'], types: ['impact'] }
        ];
        const ctx = context(lots, { gear, optedOutGear: ['g2'] });
        const [scene] = designOptions(request(ctx, { useSpecificGear: true, gearIds: ['g1', 'g2'] }), ctx);
        const gearUsed = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps.map((s) => s.gearId))).filter(Boolean);
        expect(gearUsed).toContain('g1');
        expect(gearUsed).not.toContain('g2');
    });
    it('record the intake version and schedule a next-morning check-in for intense peaks', () => {
        const ctx = context(lots);
        const picks = suggestedPicks(ctx).map((p) => ({ ...p, intensity: 9 }));
        const [scene] = designOptions(request(ctx, { picks }), ctx);
        expect(scene.intakeVersion).toBe(3);
        expect(scene.nextMorningCheckIn).toBe(true);
    });
});
describe('planned impact gear', () => {
    const gear = [
        { id: 'hand', name: 'Leather glove', feel: ['thuddy'], types: ['impact'] },
        { id: 'suede', name: 'Suede flogger', feel: ['thuddy'], types: ['impact'] },
        { id: 'paddle', name: 'Wood paddle', feel: ['thuddy'], types: ['impact'] },
        { id: 'rattan', name: 'Rattan cane', feel: ['stingy'], types: ['impact'] }
    ];
    const impactPlan = [
        { gearId: 'hand', activityId: 'bare-hand' },
        { gearId: 'suede', activityId: 'flogger' },
        { gearId: 'paddle', activityId: 'paddle' },
        { gearId: 'rattan', activityId: 'cane' }
    ];
    it('uses the gear in the planned order, from the warm-up to the peak', () => {
        const ctx = context(lots, { gear });
        for (const scene of designOptions(request(ctx, { impactPlan }), ctx)) {
            const order = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps.map((s) => s.gearId))).filter(Boolean);
            const firstSeen = [...new Set(order)];
            expect(firstSeen).toEqual(['hand', 'suede', 'paddle', 'rattan']);
            const warm = scene.phases.find((p) => p.type === 'build').beats[0];
            expect(warm.steps.some((s) => s.gearId === 'hand')).toBe(true);
            expect(blocks(validate(scene, ctx))).toEqual([]);
        }
    });
    it('leaves out planned gear kept out of scenes with this person', () => {
        const ctx = context(lots, { gear, optedOutGear: ['rattan'] });
        const [scene] = designOptions(request(ctx, { impactPlan }), ctx);
        const used = scene.phases.flatMap((p) => p.beats.flatMap((b) => b.steps.map((s) => s.gearId)));
        expect(used).not.toContain('rattan');
    });
});
