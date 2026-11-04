import { activities, categories, type Activity, type CategoryId } from '../data/activities';
import type { PhaseColors } from './phases';
import { aftercare } from './topDefaults';

// The Top's setup (M3): what they offer and to what degree (O4), and their
// personal standards (O5). The rules engine (M4) designs only from what is
// offered here, and never above the degree set for a category.

/** How far a Top goes in a category, on a 1 (gentle) to 10 (intense) scale. */
export type Degree = number;

export const DEGREE_RANGE = { min: 1, max: 10 };
export const degreeEnds = { low: 'Gentle', high: 'Intense' };

/** The range a Top plays in for one category, both ends included. */
export interface DegreeRange {
  min: Degree;
  max: Degree;
}

export interface CategoryOffering extends DegreeRange {
  on: boolean;
}

export const defaultRange = (): DegreeRange => ({ min: 1, max: 6 });

export function rangeText(r: DegreeRange): string {
  return r.min === r.max ? `${r.min}` : `${r.min} to ${r.max}`;
}

export interface Offerings {
  /** Categories this Top plays in, each with how far they go. */
  categories: Partial<Record<CategoryId, CategoryOffering>>;
  /** Activity choices that differ from the default for their category. */
  activities: Record<string, boolean>;
  /** The Top's own names for built-in activities, by activity id. */
  renames: Record<string, string>;
  /** The Top's own activities. They behave exactly like built-in ones. */
  custom: Activity[];
  /** When the Top last saved this step; null until they do. */
  setAt: string | null;
}

export type CheckInCadence = 'none' | 'weekly' | 'twice-weekly' | 'daily';

export const cadenceLabels: Record<CheckInCadence, string> = {
  none: 'None',
  weekly: 'Weekly',
  'twice-weekly': 'Twice a week',
  daily: 'Daily'
};

export interface TopSettings {
  /** Aftercare as a share of scene length. */
  aftercarePercent: number;
  /** The same for scenes marked intense (never under 30 minutes). */
  intensePercent: number;
  checkIns: CheckInCadence;
  /** One line describing how this Top speaks, used for SAY suggestions. */
  voice: string;
  /**
   * Penile or oral sex can appear in this Top's scenes, and only when
   * negotiated for that scene. Off by default for everyone.
   */
  allowNegotiatedSex: boolean;
  phaseColors: Partial<PhaseColors>;
  setAt: string | null;
}

export interface TopSetup {
  offerings: Offerings;
  settings: TopSettings;
}

export const AFTERCARE_RANGE = { min: 10, max: 60 };

export function emptyOfferings(): Offerings {
  return { categories: {}, activities: {}, renames: {}, custom: [], setAt: null };
}

export function defaultTopSettings(): TopSettings {
  return {
    aftercarePercent: aftercare.defaultPercent,
    intensePercent: aftercare.intensePercent,
    checkIns: 'none',
    voice: '',
    allowNegotiatedSex: false,
    phaseColors: {},
    setAt: null
  };
}

export function emptyTopSetup(): TopSetup {
  return { offerings: emptyOfferings(), settings: defaultTopSettings() };
}

/**
 * The "Default settings" button: A.C.E.'s standards as a ready-made start. It
 * never turns sex acts on; that stays the Top's own deliberate choice.
 */
export function startingSettings(): Omit<TopSettings, 'setAt' | 'phaseColors' | 'allowNegotiatedSex'> {
  return {
    aftercarePercent: 25,
    intensePercent: 33,
    checkIns: 'twice-weekly',
    voice: 'Direct, warm, unhurried, observational, specific.'
  };
}

/**
 * Whether an activity is on by default once its category is on. Edge play and
 * negotiated-only items never are: the Top turns each one on deliberately.
 */
export function onByDefault(a: Activity): boolean {
  return !a.edge && !a.negotiatedOnly;
}

/** Whether this Top can see and offer an activity at all. */
export function available(a: Activity, settings: TopSettings, studio: boolean): boolean {
  if (a.edge && !studio) return false;
  if (a.negotiatedOnly && !settings.allowNegotiatedSex) return false;
  return true;
}

/** Every activity this Top can offer, with their own names applied. */
export function allTopActivities(offerings: Offerings): Activity[] {
  const renamed = activities.map((a) => (offerings.renames[a.id] ? { ...a, label: offerings.renames[a.id] } : a));
  return [...renamed, ...offerings.custom];
}

/** Whether the Top offers this activity, given their categories and settings. */
export function isOffered(setup: TopSetup, a: Activity, studio: boolean): boolean {
  const cat = setup.offerings.categories[a.category];
  if (!cat?.on || !available(a, setup.settings, studio)) return false;
  return setup.offerings.activities[a.id] ?? (a.custom ? true : onByDefault(a));
}

/** Everything this Top offers, with the range for its category. */
export function offeredActivities(setup: TopSetup, studio: boolean): { activity: Activity; range: DegreeRange }[] {
  return allTopActivities(setup.offerings)
    .filter((a) => isOffered(setup, a, studio))
    .map((activity) => {
      const { min, max } = setup.offerings.categories[activity.category]!;
      return { activity, range: { min, max } };
    });
}

export function offeringsSummary(setup: TopSetup): string {
  const on = categories.filter((c) => setup.offerings.categories[c.id]?.on);
  if (!on.length) return 'Nothing chosen yet';
  return on.map((c) => `${c.label} (${rangeText(setup.offerings.categories[c.id]!)})`).join(', ');
}

/** Keeps saved settings inside the allowed range after any change. */
export function clampSettings(s: TopSettings): TopSettings {
  const clamp = (n: number) => Math.round(Math.min(AFTERCARE_RANGE.max, Math.max(AFTERCARE_RANGE.min, n)));
  return { ...s, aftercarePercent: clamp(s.aftercarePercent), intensePercent: clamp(s.intensePercent) };
}

const clampDegree = (n: number) => Math.round(Math.min(DEGREE_RANGE.max, Math.max(DEGREE_RANGE.min, n)));

/** Keeps a range on the scale, with its low end at or under its high end. */
export function clampRange(r: DegreeRange): DegreeRange {
  const min = clampDegree(r.min);
  return { min, max: Math.max(min, clampDegree(r.max)) };
}

/**
 * Older saves kept one degree from 1 (gentle) to 5 (intense). That becomes a
 * range from 1 up to the same point on the 10 scale.
 */
function upgradeCategories(saved: Record<string, unknown> | undefined): Offerings['categories'] {
  const out: Offerings['categories'] = {};
  for (const [id, raw] of Object.entries(saved ?? {})) {
    const c = raw as Partial<CategoryOffering> & { degree?: number };
    const range =
      typeof c.min === 'number' && typeof c.max === 'number' ? { min: c.min, max: c.max } : c.degree ? { min: 1, max: c.degree * 2 } : defaultRange();
    out[id as CategoryId] = { on: Boolean(c.on), ...clampRange(range) };
  }
  return out;
}

/** Fills in anything missing from a saved setup, for older saves. */
export function defaultTopSetupFrom(saved: Partial<TopSetup> | undefined): TopSetup {
  return {
    offerings: { ...emptyOfferings(), ...saved?.offerings, categories: upgradeCategories(saved?.offerings?.categories) },
    settings: { ...defaultTopSettings(), ...saved?.settings }
  };
}
