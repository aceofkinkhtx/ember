import { newBeat, newStep, type Phase, type Scene } from './scene/model';
import { cleanDesign, designFromAgreed, itemsFromDesign } from './negotiations';

// Shared designs (Michael, Nov 16): a design becomes a proposal list, and once
// agreed the Top gets it back with anything taken off the list removed.

const phase = (type: Phase['type'], beats: Phase['beats'], setup?: Phase['setup']): Phase => ({ id: `p-${type}`, type, beats, setup });

function design(): Scene {
  return {
    v: 1,
    id: 'd1',
    title: 'Slow burn',
    connectionId: 'c-old',
    partnerId: 'u-old',
    partnerName: 'Wren',
    role: 'top',
    date: '',
    startTime: '',
    minutes: 60,
    location: '',
    isPublic: false,
    intense: false,
    intakeVersion: 3,
    marks: 'day',
    useSpecificGear: false,
    gearIds: [],
    picks: [
      { activityId: 'flogger', intensity: 5, surprise: false },
      { activityId: 'wax', intensity: 4, surprise: false }
    ],
    notes: '',
    shape: 'climb',
    overrides: [{ activityId: 'wax', kind: 'no', confirmedAt: '2026-11-01' }],
    kept: {},
    nextMorningCheckIn: false,
    inLibrary: true,
    noRoles: true,
    createdAt: '',
    updatedAt: '',
    phases: [
      phase('build', [newBeat({ steps: [newStep({ activityId: 'flogger' }), newStep({ say: 'Breathe with me.' })] })], { position: 'kneeling', furniture: 'bench' }),
      phase('peak', [newBeat({ steps: [newStep({ activityId: 'wax' }), newStep({ activityId: 'flogger' })] })], { position: 'prone', furniture: null })
    ]
  };
}

const labels: Record<string, string> = { flogger: 'Flogger', wax: 'Wax play' };

describe('a shared design as a proposal', () => {
  it('lists each activity, position and furniture once', () => {
    const items = itemsFromDesign(design(), 'me', (id) => labels[id]);
    expect(items.map((i) => i.id)).toEqual(['p:kneeling', 'u:bench', 'a:flogger', 'p:prone', 'a:wax']);
    expect(items.every((i) => i.addedBy === 'me' && i.removedBy === null)).toBe(true);
  });

  it('travels without the old pairing', () => {
    const d = cleanDesign(design());
    expect(d.connectionId).toBeNull();
    expect(d.partnerName).toBe('');
    expect(d.overrides).toEqual([]);
  });

  it('comes back to the Top without what was taken off', () => {
    const agreed = { negotiationId: 'n1', activityIds: ['flogger'], noAllowed: [], notThisTime: [], words: [], positions: ['kneeling'], furniture: [] };
    const out = designFromAgreed(design(), agreed);
    const steps = out.phases.flatMap((p) => p.beats.flatMap((b) => b.steps));
    expect(steps.some((s) => s.activityId === 'wax')).toBe(false);
    expect(steps.filter((s) => s.activityId === 'flogger')).toHaveLength(2);
    expect(steps.some((s) => s.say === 'Breathe with me.')).toBe(true);
    expect(out.picks.map((p) => p.activityId)).toEqual(['flogger']);
    expect(out.phases[0].setup).toEqual({ position: 'kneeling', furniture: null });
    expect(out.phases[1].setup).toEqual({ position: null, furniture: null });
  });
});
