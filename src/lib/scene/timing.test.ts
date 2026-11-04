import { defaultTopSettings } from '../../content/topSetup';
import { newBeat, newStep, type Scene } from './model';
import { moveStep, playMinutes, scaleBeats, setPhaseMinutes, setPlayMinutes } from './timing';

function scene(): Scene {
  const step = newStep({ id: 'cuffs', activityId: 'soft-cuffs' });
  return {
    phases: [
      { id: 'a', type: 'arrival', beats: [newBeat({ id: 'b1', minutes: 10 })] },
      { id: 'p', type: 'peak', beats: [newBeat({ id: 'b2', minutes: 20, steps: [step] }), newBeat({ id: 'b3', minutes: 10 })] },
      { id: 'c', type: 'aftercare', beats: [newBeat({ id: 'b4', minutes: 10 })] }
    ],
    intense: false,
    minutes: 40
  } as Scene;
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
