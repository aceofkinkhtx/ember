import { activities, categories, type Activity, type CategoryId } from '../data/activities';
import type { PhaseColors } from './phases';
import { aftercare } from './topDefaults';

// The Top's setup (M3): what they offer and to what degree (O4), and their
// personal standards (O5). The rules engine (M4) designs only from what is
// offered here, and never above the degree set for a category.

export type Degree = 1 | 2 | 3 | 4 | 5;

export const degreeLabels: Record<Degree, string> = {
  1: 'Gentle',
  2: 'Light',
  3: 'Medium',
  4: 'Strong',
  5: 'Intense'
};

export interface Offerings {
  /** Categories this Top plays in, each with how far they go. */
  categories: Partial<Record<CategoryId, { on: boolean; degree: Degree }>>;
  /** Activity choices that differ from the default for their category. */
  activities: Record<string, boolean>;
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
  return { categories: {}, activities: {}, custom: [], setAt: null };
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

/** A.C.E.'s own standards, offered as a ready-made starting point. */
export function aceSettings(): Omit<TopSettings, 'setAt' | 'phaseColors'> {
  return {
    aftercarePercent: 25,
    intensePercent: 33,
    checkIns: 'twice-weekly',
    voice: 'Direct, warm, unhurried, observational, specific.',
    allowNegotiatedSex: true
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

export function allTopActivities(offerings: Offerings): Activity[] {
  return [...activities, ...offerings.custom];
}

/** Whether the Top offers this activity, given their categories and settings. */
export function isOffered(setup: TopSetup, a: Activity, studio: boolean): boolean {
  const cat = setup.offerings.categories[a.category];
  if (!cat?.on || !available(a, setup.settings, studio)) return false;
  return setup.offerings.activities[a.id] ?? (a.custom ? true : onByDefault(a));
}

/** Everything this Top offers, with the degree for its category. */
export function offeredActivities(setup: TopSetup, studio: boolean): { activity: Activity; degree: Degree }[] {
  return allTopActivities(setup.offerings)
    .filter((a) => isOffered(setup, a, studio))
    .map((activity) => ({ activity, degree: setup.offerings.categories[activity.category]!.degree }));
}

export function offeringsSummary(setup: TopSetup): string {
  const on = categories.filter((c) => setup.offerings.categories[c.id]?.on);
  if (!on.length) return 'Nothing chosen yet';
  return on.map((c) => `${c.label} (${degreeLabels[setup.offerings.categories[c.id]!.degree].toLowerCase()})`).join(', ');
}

/** Keeps saved settings inside the allowed range after any change. */
export function clampSettings(s: TopSettings): TopSettings {
  const clamp = (n: number) => Math.round(Math.min(AFTERCARE_RANGE.max, Math.max(AFTERCARE_RANGE.min, n)));
  return { ...s, aftercarePercent: clamp(s.aftercarePercent), intensePercent: clamp(s.intensePercent) };
}

/** Fills in anything missing from a saved setup, for older saves. */
export function defaultTopSetupFrom(saved: Partial<TopSetup> | undefined): TopSetup {
  return {
    offerings: { ...emptyOfferings(), ...saved?.offerings },
    settings: { ...defaultTopSettings(), ...saved?.settings }
  };
}
