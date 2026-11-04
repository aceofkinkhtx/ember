import { activities } from '../data/activities';
import { whiteTextContrast } from './contrast';
import { defaultPhaseColors, secondPeakColor } from './phases';
import {
  clampRange,
  clampSettings,
  defaultTopSettings,
  defaultTopSetupFrom,
  emptyTopSetup,
  isOffered,
  offeredActivities,
  offeringsSummary,
  startingSettings,
  type TopSetup
} from './topSetup';

const byId = (id: string) => activities.find((a) => a.id === id)!;

function withImpactAndTouch(): TopSetup {
  const setup = emptyTopSetup();
  setup.offerings.categories = { impact: { on: true, min: 2, max: 6 }, touch: { on: true, min: 1, max: 4 } };
  return setup;
}

describe('offerings', () => {
  it('offer nothing until a category is turned on', () => {
    expect(offeredActivities(emptyTopSetup(), true)).toEqual([]);
    expect(offeringsSummary(emptyTopSetup())).toBe('Nothing chosen yet');
  });

  it('offer every regular activity in a category that is on, with its range', () => {
    const offered = offeredActivities(withImpactAndTouch(), false);
    expect(offered.find((o) => o.activity.id === 'flogger')?.range).toEqual({ min: 2, max: 6 });
    expect(offered.find((o) => o.activity.id === 'cuddling')?.range).toEqual({ min: 1, max: 4 });
    expect(offered.some((o) => o.activity.category === 'bondage')).toBe(false);
    expect(offeringsSummary(withImpactAndTouch())).toBe('Impact (2 to 6), Touch and intimacy (1 to 4)');
  });

  it('let the Top turn single activities off', () => {
    const setup = withImpactAndTouch();
    setup.offerings.activities = { cane: false };
    expect(isOffered(setup, byId('cane'), false)).toBe(false);
    expect(isOffered(setup, byId('whip'), false)).toBe(true);
  });

  it('never include edge play outside Studio mode, and never by default', () => {
    const setup = emptyTopSetup();
    setup.offerings.categories = { sensation: { on: true, min: 1, max: 10 } };
    expect(isOffered(setup, byId('knife-play'), true)).toBe(false);
    setup.offerings.activities = { 'knife-play': true };
    expect(isOffered(setup, byId('knife-play'), true)).toBe(true);
    expect(isOffered(setup, byId('knife-play'), false)).toBe(false);
    expect(isOffered(setup, byId('electricity'), false)).toBe(true);
  });

  it('keep penile and oral sex out unless the Top allows it, and even then until chosen', () => {
    const setup = withImpactAndTouch();
    setup.offerings.activities = { 'giving-oral': true };
    expect(isOffered(setup, byId('giving-oral'), true)).toBe(false);
    setup.settings.allowNegotiatedSex = true;
    expect(isOffered(setup, byId('giving-oral'), true)).toBe(true);
    expect(isOffered(setup, byId('receiving-oral'), true)).toBe(false);
  });

  it("use the Top's own names for built-in activities", () => {
    const setup = withImpactAndTouch();
    setup.offerings.renames = { cane: 'Rattan' };
    const offered = offeredActivities(setup, false);
    expect(offered.find((o) => o.activity.id === 'cane')?.activity.label).toBe('Rattan');
    expect(offered.find((o) => o.activity.id === 'whip')?.activity.label).toBe(byId('whip').label);
  });

  it('keep a range on the 1 to 10 scale, low end first', () => {
    expect(clampRange({ min: 0, max: 14 })).toEqual({ min: 1, max: 10 });
    expect(clampRange({ min: 7, max: 3 })).toEqual({ min: 7, max: 7 });
  });

  it('turn an older single degree into a range', () => {
    const setup = defaultTopSetupFrom({ offerings: { categories: { impact: { on: true, degree: 4 } } } } as never);
    expect(setup.offerings.categories.impact).toEqual({ on: true, min: 1, max: 8 });
    expect(setup.offerings.renames).toEqual({});
  });

  it("include the Top's own activities like built-in ones", () => {
    const setup = withImpactAndTouch();
    setup.offerings.custom = [{ id: 'custom-1', label: 'Wooden spoon', category: 'impact', custom: true }];
    expect(offeredActivities(setup, false).some((o) => o.activity.id === 'custom-1')).toBe(true);
    setup.offerings.categories.impact!.on = false;
    expect(offeredActivities(setup, false).some((o) => o.activity.id === 'custom-1')).toBe(false);
  });
});

describe('Top settings', () => {
  it("start at A.C.E.'s aftercare, with sex acts off for everyone", () => {
    const s = defaultTopSettings();
    expect([s.aftercarePercent, s.intensePercent]).toEqual([25, 33]);
    expect(s.allowNegotiatedSex).toBe(false);
    expect(startingSettings().checkIns).toBe('twice-weekly');
    expect('allowNegotiatedSex' in startingSettings()).toBe(false);
  });

  it('keep aftercare within range', () => {
    const s = clampSettings({ ...defaultTopSettings(), aftercarePercent: 0, intensePercent: 400 });
    expect([s.aftercarePercent, s.intensePercent]).toEqual([10, 60]);
  });

  it('fill in anything missing from an older save', () => {
    const setup = defaultTopSetupFrom({ settings: { aftercarePercent: 30 } as never });
    expect(setup.settings.aftercarePercent).toBe(30);
    expect(setup.settings.intensePercent).toBe(33);
    expect(setup.offerings.custom).toEqual([]);
  });
});

describe('phase colors', () => {
  it('all keep white text readable', () => {
    for (const color of [...Object.values(defaultPhaseColors), secondPeakColor]) expect(whiteTextContrast(color)).toBeGreaterThanOrEqual(4.5);
  });

  it('flag colors too light for white text', () => {
    expect(whiteTextContrast('#FFD966')).toBeLessThan(4.5);
    expect(whiteTextContrast('#000000')).toBeCloseTo(21, 0);
  });
});
