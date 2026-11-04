import { emptyTopSetup } from '../../content/topSetup';
import { emptyDetailed, emptyIntake, type Intake } from '../intake';
import { newBeat, newStep, type Phase, type Scene } from './model';
import { automaticFlags, blocks, needsNextMorningCheckIn, tryChange, validate, warnings, type RuleContext } from './rules';

// Every block rule has a test here (CLAUDE.md: write the tests first). Each
// starts from a scene that passes everything, breaks one rule, and checks the
// validator refuses it with a one-line reason.

function intake(answers: Record<string, 'yes' | 'maybe' | 'no'> = {}): Intake {
  const i = emptyIntake();
  i.paths = ['detailed'];
  i.detailed = emptyDetailed();
  i.detailed.impact.marks = 'day';
  for (const [id, choice] of Object.entries(answers)) i.detailed.answers[id] = { choice };
  return i;
}

function context(patch: Partial<RuleContext> = {}): RuleContext {
  const top = emptyTopSetup();
  top.offerings.categories = {
    impact: { on: true, min: 1, max: 10 },
    bondage: { on: true, min: 1, max: 10 },
    sensation: { on: true, min: 1, max: 10 },
    touch: { on: true, min: 1, max: 10 },
    penetration: { on: true, min: 1, max: 10 }
  };
  return {
    intake: intake({ 'bare-hand': 'yes', flogger: 'yes', cane: 'yes', 'soft-cuffs': 'yes', cuddling: 'yes', blindfold: 'yes', wax: 'maybe', biting: 'no' }),
    top,
    studio: false,
    optedOutGear: [],
    gear: [],
    ...patch
  };
}

const phase = (type: Phase['type'], beats: Phase['beats']): Phase => ({ id: `p-${type}-${Math.random()}`, type, beats });

/** A short scene that passes every rule. */
function goodScene(): Scene {
  return {
    v: 1,
    id: 'scene-1',
    title: 'Test scene',
    connectionId: 'c1',
    partnerId: 'u2',
    partnerName: 'Wren',
    role: 'top',
    date: '',
    startTime: '',
    minutes: 60,
    location: '',
    isPublic: false,
    intense: false,
    intakeVersion: 1,
    marks: 'day',
    useSpecificGear: false,
    gearIds: [],
    picks: [],
    notes: '',
    shape: 'climb',
    overrides: [],
    kept: {},
    nextMorningCheckIn: false,
    inLibrary: false,
    createdAt: '',
    updatedAt: '',
    phases: [
      phase('arrival', [newBeat({ id: 'arrive', title: 'Arrive', minutes: 6, intensity: 2, steps: [newStep({ activityId: 'cuddling', do: 'Hold them.' })] })]),
      phase('build', [
        newBeat({ id: 'warm', kind: 'warmup', title: 'Warm up', minutes: 10, intensity: 3, areas: ['butt'], steps: [newStep({ activityId: 'bare-hand' })] }),
        newBeat({ id: 'build', title: 'Build', minutes: 10, intensity: 5, areas: ['butt'], steps: [newStep({ activityId: 'flogger' })] })
      ]),
      phase('peak', [newBeat({ id: 'peak', title: 'Peak', minutes: 12, intensity: 7, areas: ['butt'], steps: [newStep({ activityId: 'cane' })] })]),
      phase('descent', [newBeat({ id: 'down', kind: 'landing', title: 'Land', minutes: 8, intensity: 3, steps: [newStep({ say: 'We are coming down now.' })] })]),
      phase('close', [newBeat({ id: 'close', kind: 'named', title: 'Close', minutes: 4, intensity: 1, steps: [newStep({ say: 'You held so still for me.' })] })]),
      phase('aftercare', [
        newBeat({ id: 'ac1', kind: 'immediate', title: 'Immediate', minutes: 5, intensity: 1 }),
        newBeat({ id: 'ac2', kind: 'settled', title: 'Settled', minutes: 5, intensity: 1 }),
        newBeat({ id: 'ac3', kind: 'closing', title: 'Close', minutes: 5, intensity: 1 })
      ])
    ]
  };
}

const blockRules = (scene: Scene, ctx = context()) => blocks(validate(scene, ctx)).map((i) => i.rule);
const beat = (scene: Scene, id: string) => scene.phases.flatMap((p) => p.beats).find((b) => b.id === id)!;
const without = (scene: Scene, type: Phase['type']) => ({ ...scene, phases: scene.phases.filter((p) => p.type !== type) });

describe('a well-built scene', () => {
  it('passes every block rule', () => {
    expect(blockRules(goodScene())).toEqual([]);
  });
});

describe('block: the arc', () => {
  it.each(['arrival', 'peak', 'descent', 'close', 'aftercare'] as const)('needs a %s phase', (type) => {
    expect(blockRules(without(goodScene(), type))).toContain('arc');
  });

  it('keeps aftercare last and arrival first', () => {
    const s = goodScene();
    s.phases = [...s.phases.slice(1, -1), s.phases[s.phases.length - 1], s.phases[0]];
    expect(blockRules(s)).toContain('arc-order');
    const t = goodScene();
    t.phases = [t.phases[t.phases.length - 1], ...t.phases.slice(0, -1)];
    expect(blockRules(t)).toContain('arc-order');
  });

  it('needs a spoken landing line in the descent', () => {
    const s = goodScene();
    beat(s, 'down').steps[0].say = '';
    expect(blockRules(s)).toContain('landing');
  });
});

describe('block: warm-up', () => {
  it('refuses a beat above 4 before any warm-up beat', () => {
    const s = goodScene();
    beat(s, 'arrive').intensity = 5;
    expect(blockRules(s)).toContain('warmup');
  });

  it('refuses a scene with no warm-up once it goes above 4', () => {
    const s = goodScene();
    beat(s, 'warm').kind = 'regular';
    expect(blockRules(s)).toContain('warmup');
  });
});

describe('block: recovery between peaks', () => {
  it('refuses two peaks with nothing restful between them', () => {
    const s = goodScene();
    const second = phase('peak', [newBeat({ id: 'peak2', minutes: 14, intensity: 8, steps: [newStep({ activityId: 'cane' })] })]);
    s.phases.splice(3, 0, second);
    expect(blockRules(s)).toContain('recovery');
    s.phases.splice(3, 0, phase('recovery', [newBeat({ kind: 'recovery', title: 'Water and a check-in', minutes: 4, intensity: 2 })]));
    expect(blockRules(s)).not.toContain('recovery');
  });
});

describe('block: impact areas', () => {
  it('never targets the kidneys', () => {
    const s = goodScene();
    beat(s, 'build').areas = ['kidneys'];
    expect(blockRules(s)).toContain('kidneys');
  });
});

describe('block: marks', () => {
  it('keeps to no marks when that is the setting', () => {
    const s = goodScene();
    s.marks = 'none';
    expect(blockRules(s)).toContain('marks');
    beat(s, 'peak').steps = [newStep({ activityId: 'flogger' })];
    beat(s, 'peak').intensity = 6;
    expect(blockRules(s)).not.toContain('marks');
  });

  it('keeps marks to the day when that is the setting', () => {
    const s = goodScene();
    beat(s, 'peak').intensity = 8;
    expect(blockRules(s)).toContain('marks');
    s.marks = 'week';
    expect(blockRules(s)).not.toContain('marks');
  });
});

describe('block: limits', () => {
  it('refuses a no item while the bottom has not allowed overrides', () => {
    const s = goodScene();
    beat(s, 'build').steps.push(newStep({ activityId: 'biting' }));
    expect(blockRules(s)).toContain('limits');
    // A confirmed override is not enough on its own.
    s.overrides = [{ activityId: 'biting', kind: 'no', confirmedAt: '2026-11-04' }];
    expect(blockRules(s)).toContain('limits');
  });

  it('needs the confirmed override when the bottom allows one', () => {
    const ctx = context();
    ctx.intake!.essentials.allowNoOverride = { on: true, changedAt: '2026-11-01' };
    const s = goodScene();
    beat(s, 'build').steps.push(newStep({ activityId: 'biting' }));
    expect(blockRules(s, ctx)).toContain('limits');
    s.overrides = [{ activityId: 'biting', kind: 'no', confirmedAt: '2026-11-04' }];
    expect(blockRules(s, ctx)).not.toContain('limits');
  });

  it('refuses gear opted out for this person', () => {
    const s = goodScene();
    beat(s, 'build').steps[0].gearId = 'gear-1';
    expect(blockRules(s, context({ optedOutGear: ['gear-1'] }))).toContain('opted-out');
    expect(blockRules(s)).not.toContain('opted-out');
  });
});

describe('block: edge play', () => {
  it('needs Studio mode and a confirmed negotiation', () => {
    const ctx = context();
    ctx.intake!.detailed!.answers['knife-play'] = { choice: 'yes' };
    const s = goodScene();
    beat(s, 'peak').steps.push(newStep({ activityId: 'knife-play' }));
    expect(blockRules(s, ctx)).toContain('edge');
    s.overrides = [{ activityId: 'knife-play', kind: 'edge', confirmedAt: '2026-11-04' }];
    expect(blockRules(s, ctx)).toContain('edge');
    expect(blockRules(s, { ...ctx, studio: true })).not.toContain('edge');
  });
});

describe('block: negotiated-only sex acts', () => {
  it('needs the Top to allow them and to confirm they were negotiated', () => {
    const ctx = context();
    ctx.intake!.detailed!.answers['giving-oral'] = { choice: 'yes' };
    const s = goodScene();
    beat(s, 'peak').steps.push(newStep({ activityId: 'giving-oral' }));
    s.overrides = [{ activityId: 'giving-oral', kind: 'negotiated', confirmedAt: '2026-11-04' }];
    expect(blockRules(s, ctx)).toContain('negotiated');
    ctx.top.settings.allowNegotiatedSex = true;
    expect(blockRules(s, ctx)).not.toContain('negotiated');
    s.overrides = [];
    expect(blockRules(s, ctx)).toContain('negotiated');
  });
});

describe('block: aftercare', () => {
  it('gives aftercare at least the Top setting, and 30 minutes when intense', () => {
    const s = goodScene();
    s.intense = true;
    expect(blockRules(s)).toContain('aftercare');
    for (const b of s.phases[s.phases.length - 1].beats) b.minutes = 10;
    expect(blockRules(s)).not.toContain('aftercare');
  });
});

describe('block: next-morning check-in', () => {
  it('is required once a scene reaches subspace or release', () => {
    const s = goodScene();
    s.marks = 'open';
    beat(s, 'peak').intensity = 9;
    expect(needsNextMorningCheckIn(s, context())).toBe(true);
    expect(blockRules(s)).toContain('check-in');
    s.nextMorningCheckIn = true;
    expect(blockRules(s)).not.toContain('check-in');
  });

  it('counts a bottom who looks for emotional release', () => {
    const ctx = context();
    ctx.intake!.quick = { words: { heat: [], hold: [], flow: [] }, decoder: { heat: ['release'] } };
    expect(needsNextMorningCheckIn(goodScene(), ctx)).toBe(true);
  });
});

describe('automatic: triggers, watch list and crying guidance', () => {
  it('puts each known trigger on the beats where it is likely to surface', () => {
    const ctx = context();
    ctx.intake!.essentials.triggers = { chips: ['Darkness', 'Being held down', 'Raised voices'], notes: 'Feet near my face' };
    const s = goodScene();
    beat(s, 'build').steps.push(newStep({ activityId: 'blindfold' }));
    beat(s, 'warm').steps.push(newStep({ activityId: 'soft-cuffs' }));
    const flags = automaticFlags(s, ctx);
    const warn = (id: string) => (flags.get(id) ?? []).filter((f) => f.kind === 'warning').map((f) => f.text).join(' ');
    expect(warn('build')).toMatch(/Darkness/);
    expect(warn('warm')).toMatch(/Being held down/);
    expect(warn('peak')).toMatch(/Raised voices/);
    expect(warn('peak')).toMatch(/Feet near my face/);
    expect(warn('arrive')).toBe('');
  });

  it('adds the core watch list to every build and peak beat, and crying guidance to peaks', () => {
    const flags = automaticFlags(goodScene(), context());
    expect((flags.get('build') ?? []).some((f) => f.kind === 'watch')).toBe(true);
    expect((flags.get('peak') ?? []).some((f) => f.kind === 'info' && /Crying/.test(f.text))).toBe(true);
    expect((flags.get('arrive') ?? []).some((f) => f.kind === 'watch')).toBe(false);
  });
});

describe('warn rules', () => {
  it('flag maybe items with "Discussed together?" and can be kept with a reason', () => {
    const s = goodScene();
    beat(s, 'build').steps.push(newStep({ activityId: 'wax' }));
    const maybe = warnings(validate(s, context())).find((i) => i.rule === 'maybe');
    expect(maybe?.message).toMatch(/Discussed together\?/);
    s.kept[maybe!.key] = { reason: 'We talked on Sunday', at: '2026-11-04' };
    expect(warnings(validate(s, context())).find((i) => i.rule === 'maybe')?.kept?.reason).toBe('We talked on Sunday');
  });

  it('flag impact out of order and intensity dropping mid-build', () => {
    const s = goodScene();
    beat(s, 'warm').steps = [newStep({ activityId: 'cane' })];
    beat(s, 'build').intensity = 3;
    beat(s, 'warm').intensity = 4;
    const rules = warnings(validate(s, context())).map((i) => i.rule);
    expect(rules).toContain('impact-order');
    expect(rules).toContain('build-drop');
  });
});

describe('editing', () => {
  it('refuses a change that breaks a block rule, with a one-line reason', () => {
    const before = goodScene();
    const after = goodScene();
    beat(after, 'build').areas = ['kidneys'];
    const result = tryChange(before, after, context());
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toMatch(/kidneys/i);
  });

  it('allows a change that keeps every block rule', () => {
    const after = goodScene();
    beat(after, 'build').intensity = 6;
    expect(tryChange(goodScene(), after, context()).ok).toBe(true);
  });
});
