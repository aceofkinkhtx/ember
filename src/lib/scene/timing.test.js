import { defaultTopSettings } from '../../content/topSetup';
import { newBeat, newStep } from './model';
import { aftercareTotal, moveStep, placeBeat, placeStep, playMinutes, scaleBeats, setPhaseMinutes, setPlayMinutes, withAftercareFit } from './timing';
function scene() {
    const step = newStep({ id: 'cuffs', activityId: 'soft-cuffs' });
    return {
        phases: [
            { id: 'a', type: 'arrival', beats: [newBeat({ id: 'b1', minutes: 10 })] },
            { id: 'p', type: 'peak', beats: [newBeat({ id: 'b2', minutes: 20, steps: [step] }), newBeat({ id: 'b3', minutes: 10 })] },
            { id: 'c', type: 'aftercare', beats: [newBeat({ id: 'b4', minutes: 10 })] }
        ],
        intense: false,
        minutes: 40
    };
}
describe('editing time', () => {
    it('spreads a section length across its beats by their share', () => {
        expect(scaleBeats(scene().phases[1].beats, 60).map((b) => b.minutes)).toEqual([40, 20]);
        const s = setPhaseMinutes(scene(), 'p', 45);
        expect(s.phases[1].beats.reduce((n, b) => n + b.minutes, 0)).toBe(45);
    });
    it('changes the whole play time and grows aftercare to match the setting', () => {
        const s = setPlayMinutes(scene(), 120, defaultTopSettings());
        expect(playMinutes(s)).toBe(120);
        expect(s.phases[2].beats[0].minutes).toBe(30);
        // Shorter play time never shrinks aftercare.
        expect(setPlayMinutes(scene(), 20, defaultTopSettings()).phases[2].beats[0].minutes).toBe(10);
    });
    it('moves a step from one beat to another', () => {
        const s = scene();
        const moved = moveStep(s, s.phases[1].beats[0].steps[0], 'b1');
        expect(moved.phases[0].beats[0].steps.map((x) => x.id)).toEqual(['cuffs']);
        expect(moved.phases[1].beats[0].steps).toEqual([]);
    });
});
describe('dragging between beats and sections', () => {
    it('places a step at a chosen spot in another beat', () => {
        const s = scene();
        s.phases[0].beats[0].steps = [newStep({ id: 'x' }), newStep({ id: 'y' })];
        const next = placeStep(s, 'cuffs', 'b1', 1);
        expect(next.phases[0].beats[0].steps.map((x) => x.id)).toEqual(['x', 'cuffs', 'y']);
        expect(next.phases[1].beats[0].steps).toEqual([]);
    });
    it('places a beat in another section, keeping its time', () => {
        const next = placeBeat(scene(), 'b3', 'a', 0);
        expect(next.phases[0].beats.map((b) => b.id)).toEqual(['b3', 'b1']);
        expect(next.phases[1].beats.map((b) => b.id)).toEqual(['b2']);
        expect(playMinutes(next)).toBe(40);
    });
});
describe('aftercare follows a longer scene', () => {
    it('grows aftercare when a beat is added, and says by how much', () => {
        const s = scene();
        const longer = { ...s, phases: s.phases.map((p) => (p.id === 'p' ? { ...p, beats: [...p.beats, newBeat({ minutes: 30 })] } : p)) };
        const { scene: fitted, grewBy } = withAftercareFit(s, longer, defaultTopSettings());
        expect(grewBy).toBeGreaterThan(0);
        expect(aftercareTotal(fitted)).toBe(10 + grewBy);
        expect(fitted.minutes).toBe(70);
    });
    it('leaves a shortened aftercare alone so the rules can refuse it', () => {
        const s = scene();
        const shorter = { ...s, phases: s.phases.map((p) => (p.id === 'c' ? { ...p, beats: [newBeat({ id: 'b4', minutes: 2 })] } : p)) };
        expect(withAftercareFit(s, shorter, defaultTopSettings()).grewBy).toBe(0);
    });
});
