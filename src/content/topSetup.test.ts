import { activities } from '../data/activities';
import { whiteTextContrast } from './contrast';
import { defaultPhaseColors, secondPeakColor } from './phases';
import {
  aceSettings,
  clampSettings,
  defaultTopSettings,
  defaultTopSetupFrom,
  emptyTopSetup,
  isOffered,
  offeredActivities,
  offeringsSummary,
  type TopSetup
} from './topSetup';

const byId = (id: string) => activities.find((a) => a.id === id)!;

function withImpactAndTouch(): TopSetup {
  const setup = emptyTopSetup();
  setup.offerings.categories = { impact: { on: true, degree: 3 }, touch: { on: true, degree: 2 } };
  return setup;
}

describe('offerings', () => {
  it('offer nothing until a category is turned on', () => {
    expect(offeredActivities(emptyTopSetup(), true)).toEqual([]);
    expect(offeringsSummary(emptyTopSetup())).toBe('Nothing chosen yet');
  });

  it('offer every regular activity in a category that is on, with its degree', () => {
    const offered = offeredActivities(withImpactAndTouch(), false);
    expect(offered.find((o) => o.activity.id === 'flogger')?.degree).toBe(3);
    expect(offered.find((o) => o.activity.id === 'cuddling')?.degree).toBe(2);
    expect(offered.some((o) => o.activity.category === 'bondage')).toBe(false);
    expect(offeringsSummary(withImpactAndTouch())).toBe('Impact (medium), Touch and intimacy (light)');
  });

  it('let the Top turn single activities off', () => {
    const setup = withImpactAndTouch();
    setup.offerings.activities = { cane: false };
    expect(isOffered(setup, byId('cane'), false)).toBe(false);
    expect(isOffered(setup, byId('whip'), false)).toBe(true);
  });

  it('never include edge play outside Studio mode, and never by default', () => {
    const setup = emptyTopSetup();
    setup.offerings.categories = { sensation: { on: true, degree: 5 } };
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
    expect(aceSettings().checkIns).toBe('twice-weekly');
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
