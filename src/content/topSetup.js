import { activities, categories } from '../data/activities';
import { aftercare } from './topDefaults';
export const DEGREE_RANGE = { min: 1, max: 10 };
export const degreeEnds = { low: 'Gentle', high: 'Intense' };
export const defaultRange = () => ({ min: 1, max: 6 });
export function rangeText(r) {
    return r.min === r.max ? `${r.min}` : `${r.min} to ${r.max}`;
}
export const cadenceLabels = {
    none: 'None',
    weekly: 'Weekly',
    'twice-weekly': 'Twice a week',
    daily: 'Daily'
};
export const AFTERCARE_RANGE = { min: 10, max: 60 };
export function emptyOfferings() {
    return { categories: {}, activities: {}, renames: {}, custom: [], setAt: null };
}
export function defaultTopSettings() {
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
export function emptyTopSetup() {
    return { offerings: emptyOfferings(), settings: defaultTopSettings() };
}
/**
 * The "Default settings" button: A.C.E.'s standards as a ready-made start. It
 * never turns sex acts on; that stays the Top's own deliberate choice.
 */
export function startingSettings() {
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
export function onByDefault(a) {
    return !a.edge && !a.negotiatedOnly;
}
/** Whether this Top can see and offer an activity at all. */
export function available(a, settings, studio) {
    if (a.edge && !studio)
        return false;
    if (a.negotiatedOnly && !settings.allowNegotiatedSex)
        return false;
    return true;
}
/** Every activity this Top can offer, with their own names applied. */
export function allTopActivities(offerings) {
    const renamed = activities.map((a) => (offerings.renames[a.id] ? { ...a, label: offerings.renames[a.id] } : a));
    return [...renamed, ...offerings.custom];
}
/** Whether the Top offers this activity, given their categories and settings. */
export function isOffered(setup, a, studio) {
    const cat = setup.offerings.categories[a.category];
    if (!cat?.on || !available(a, setup.settings, studio))
        return false;
    return setup.offerings.activities[a.id] ?? (a.custom ? true : onByDefault(a));
}
/** Everything this Top offers, with the range for its category. */
export function offeredActivities(setup, studio) {
    return allTopActivities(setup.offerings)
        .filter((a) => isOffered(setup, a, studio))
        .map((activity) => {
        const { min, max } = setup.offerings.categories[activity.category];
        return { activity, range: { min, max } };
    });
}
export function offeringsSummary(setup) {
    const on = categories.filter((c) => setup.offerings.categories[c.id]?.on);
    if (!on.length)
        return 'Nothing chosen yet';
    return on.map((c) => `${c.label} (${rangeText(setup.offerings.categories[c.id])})`).join(', ');
}
/** Keeps saved settings inside the allowed range after any change. */
export function clampSettings(s) {
    const clamp = (n) => Math.round(Math.min(AFTERCARE_RANGE.max, Math.max(AFTERCARE_RANGE.min, n)));
    return { ...s, aftercarePercent: clamp(s.aftercarePercent), intensePercent: clamp(s.intensePercent) };
}
const clampDegree = (n) => Math.round(Math.min(DEGREE_RANGE.max, Math.max(DEGREE_RANGE.min, n)));
/** Keeps a range on the scale, with its low end at or under its high end. */
export function clampRange(r) {
    const min = clampDegree(r.min);
    return { min, max: Math.max(min, clampDegree(r.max)) };
}
/**
 * Older saves kept one degree from 1 (gentle) to 5 (intense). That becomes a
 * range from 1 up to the same point on the 10 scale.
 */
function upgradeCategories(saved) {
    const out = {};
    for (const [id, raw] of Object.entries(saved ?? {})) {
        const c = raw;
        const range = typeof c.min === 'number' && typeof c.max === 'number' ? { min: c.min, max: c.max } : c.degree ? { min: 1, max: c.degree * 2 } : defaultRange();
        out[id] = { on: Boolean(c.on), ...clampRange(range) };
    }
    return out;
}
/** Fills in anything missing from a saved setup, for older saves. */
export function defaultTopSetupFrom(saved) {
    return {
        offerings: { ...emptyOfferings(), ...saved?.offerings, categories: upgradeCategories(saved?.offerings?.categories) },
        settings: { ...defaultTopSettings(), ...saved?.settings }
    };
}
