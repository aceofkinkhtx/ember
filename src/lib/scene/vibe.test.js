import { emptyTopSetup } from '../../content/topSetup';
import { emptyDetailed, emptyIntake } from '../intake';
import { design, suggestedPicks } from './designer';
import { planToSend, sceneVibe } from './vibe';
// The SceneVibe shows the shape of a scene, never the plan: no activity names,
// gear, words or notes, and surprises say only that something is planned.
function scene() {
    const intake = emptyIntake();
    intake.detailed = emptyDetailed();
    for (const id of ['bare-hand', 'flogger', 'cane', 'soft-cuffs', 'wax', 'cuddling', 'fingers-anus', 'toys-anus'])
        intake.detailed.answers[id] = { choice: 'yes' };
    const top = emptyTopSetup();
    for (const c of ['impact', 'bondage', 'sensation', 'touch', 'penetration'])
        top.offerings.categories[c] = { on: true, min: 1, max: 8 };
    const ctx = { intake, top, studio: false, optedOutGear: [], gear: [{ id: 'g1', name: 'Rattan cane', feel: ['stingy'], types: ['impact'] }] };
    const picks = suggestedPicks(ctx).map((p) => (p.activityId === 'wax' ? { ...p, surprise: true } : p));
    const req = {
        title: 'Saturday night',
        connectionId: 'c1',
        partnerId: 'u1',
        partnerName: 'Wren',
        role: 'top',
        date: '2026-11-14',
        startTime: '20:00',
        minutes: 90,
        location: 'Home',
        isPublic: false,
        intense: false,
        intakeVersion: 1,
        marks: 'day',
        useSpecificGear: true,
        gearIds: ['g1'],
        picks,
        overrides: [],
        notes: 'Private planning note'
    };
    const s = design('climb', req, ctx);
    s.prepare = 'Comfortable clothes and water.';
    s.phases[1].beats[0].steps[0].notes = 'Only for me';
    return s;
}
describe('SceneVibe', () => {
    it('keeps the shape: every beat, its time and intensity, in phase order', () => {
        const s = scene();
        const vibe = sceneVibe(s);
        expect(vibe.segments.length).toBe(s.phases.reduce((n, p) => n + p.beats.length, 0));
        expect(vibe.segments[0].phase).toBe('arrival');
        expect(vibe.segments.at(-1).phase).toBe('aftercare');
        expect(vibe.minutes).toBe(s.phases.reduce((n, p) => n + p.beats.reduce((m, b) => m + b.minutes, 0), 0));
        expect(vibe.prepare).toBe('Comfortable clothes and water.');
        expect(vibe.aftercare.length).toBe(3);
    });
    it('shows kinds of play, never the acts, gear, words or notes', () => {
        const vibe = sceneVibe(scene());
        const text = JSON.stringify(vibe);
        for (const secret of ['flogger', 'Floggers', 'cane', 'Canes', 'Rattan', 'bare-hand', 'Wax', 'wax', 'Private planning note', 'Only for me', 'SAY', 'Breathe with me']) {
            expect(text).not.toContain(secret);
        }
        expect(new Set(vibe.markers.map((m) => m.kind))).toEqual(new Set(['impact', 'bondage', 'touch', 'digital', 'penetration', 'surprise']));
    });
    it('marks each surprise without saying what kind it is', () => {
        const vibe = sceneVibe(scene());
        expect(vibe.surprises).toBeGreaterThan(0);
        expect(vibe.surprises).toBe(1);
        expect(vibe.markers.filter((m) => m.kind === 'surprise').length).toBeGreaterThanOrEqual(vibe.surprises);
        // Wax was the only sensation pick, and it's a surprise, so no sensation marker shows.
        expect(vibe.markers.some((m) => m.kind === 'sensation')).toBe(false);
    });
});
describe('the plan as sent', () => {
    it('hides surprises unless the Top reveals them, and never sends private notes or records', () => {
        const s = scene();
        s.kept = { 'maybe::x': { reason: 'Talked', at: '2026-11-01' } };
        const sent = planToSend(s, false);
        const text = JSON.stringify(sent);
        expect(text).not.toContain('wax');
        expect(text).not.toContain('Private planning note');
        expect(text).not.toContain('Only for me');
        expect(sent.kept).toEqual({});
        expect(text).toContain('A surprise. Your Top has something planned here.');
        expect(JSON.stringify(planToSend(s, true))).toContain('wax');
    });
});
