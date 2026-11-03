import { emptyIntake, essentialsMissing, limitsOf, mergeChange } from './intake';

describe('mergeChange', () => {
  it('keeps both of two quick taps that each saw the same old answers', () => {
    const base = emptyIntake();
    const tapQuick = { ...base, paths: [...base.paths, 'quick' as const] };
    const tapMap = { ...base, paths: [...base.paths, 'map' as const] };
    const afterFirst = mergeChange(base, tapQuick, base);
    const afterSecond = mergeChange(base, tapMap, afterFirst);
    expect(afterSecond.paths).toEqual(['quick', 'map']);
  });

  it('merges nested changes and removals', () => {
    const base = emptyIntake();
    const latest = { ...base, essentials: { ...base.essentials, honorifics: ['Sir'] } };
    const next = { ...base, essentials: { ...base.essentials, body: { ...base.essentials.body, areas: ['knees'] } } };
    const merged = mergeChange(base, next, latest);
    expect(merged.essentials.honorifics).toEqual(['Sir']);
    expect(merged.essentials.body.areas).toEqual(['knees']);
    const untapped = mergeChange(latest, { ...latest, essentials: { ...latest.essentials, honorifics: [] } }, merged);
    expect(untapped.essentials.honorifics).toEqual([]);
  });
});

describe('intake rules', () => {
  it('needs signals, an emergency contact or 911, and the substance agreement', () => {
    const e = emptyIntake().essentials;
    expect(essentialsMissing(e)).toEqual(['an emergency contact (or Call 911)', 'the substance agreement']);
    expect(essentialsMissing({ ...e, emergency: { kind: '911' }, substanceAgreedAt: '2026-11-04' })).toEqual([]);
    expect(essentialsMissing({ ...e, emergency: { kind: 'person', name: 'Robin', phone: '', aware: null }, substanceAgreedAt: 'x' })).toHaveLength(1);
  });

  it('turns no answers into hard limits and maybes into soft ones', () => {
    const i = emptyIntake();
    i.detailed = {
      answers: { gag: { choice: 'no' }, wax: { choice: 'maybe' }, rope: { choice: 'yes', intensity: 4 } },
      custom: [],
      impact: { areas: [], positions: [], feel: [], marks: null },
      words: { welcome: '', offLimits: '' },
      limits: { hardExtra: '', noTouch: '' }
    };
    expect(limitsOf(i)).toEqual({ hard: ['Gags'], soft: ['Wax play'] });
  });
});
