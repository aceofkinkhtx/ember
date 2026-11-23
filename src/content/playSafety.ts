import type { CategoryId } from '../data/activities';

// Safety wording for the categories added Nov 23 (Michael approved the draft in
// PLAY-CATEGORIES-DRAFT.md). Each category can have:
// - bottom: the "Before you say yes" card in the intake.
// - top: the points in the Top's offerings.
// - watch: shown on every beat that uses the category, in the editor and live.
// - reach: extra items to have within reach before Live Scene Mode starts.

export interface CategorySafety {
  bottom?: string;
  top?: string[];
  watch?: string;
  reach?: string[];
}

export const categorySafety: Partial<Record<CategoryId, CategorySafety>> = {
  bondage: {
    top: ['Mummification, sleepsacks and hoods: watch for overheating, keep the airway clear at all times, and have safety shears ready to cut them free.']
  },
  rope: {
    bottom:
      'Rope can press on nerves, most often in the upper arm, and nerve injuries can happen fast and without pain. Tell your Top right away about numbness, tingling, weakness, or "pins and needles".',
    top: [
      'Safety shears within reach, every time.',
      'One finger should slide under every wrap.',
      'Avoid tight or load-bearing wraps on the middle of the upper arm.',
      'Check hands often: they squeeze your fingers and touch thumb to each fingertip.',
      'Never leave someone tied alone.',
      'Suspension needs hands-on training and a rated hard point.'
    ],
    watch: 'Rope: check hands often. Numbness, tingling or weakness means untie now. Never around the neck.'
  },
  fire: {
    bottom:
      'Fire play uses a flammable liquid on the skin, and alcohol flames can be hard to see. Hair, lotion and some fabrics can catch. It is real fire, and it needs a trained Top. Ice and heat are gentler, but tell your Top if your skin is sensitive to cold or heat.',
    top: [
      'Damp towel and a fire extinguisher for liquid fires (Class B) within reach.',
      'Fuel container capped and well away from the play area.',
      'Hair tied back or covered.',
      'No lotions, oils or hair products on the skin.',
      'No synthetic clothing or bedding nearby.',
      'Avoid the face, the genitals, hairy areas and broken skin.',
      "Smother, don't splash: water spreads a burning liquid.",
      'Ice and cold: keep it moving, never held in one spot.'
    ],
    watch: 'Fire and temperature: damp towel and extinguisher in reach, fuel capped and away. Keep ice moving.',
    reach: ['Damp towel', 'Fire extinguisher (Class B)']
  },
  electricity: {
    bottom:
      'Tell your Top if you have a pacemaker or another implanted device, a heart condition or epilepsy, or might be pregnant. If any of these apply, electricity is not safe for you.',
    top: ['Pads below the waist only, never across the chest.', 'Start at the lowest setting.', 'Keep water and liquids away from a Violet wand.'],
    watch: 'Electricity: below the waist only, never across the chest. Start low.'
  },
  mind: {
    bottom:
      'This play goes into your head, and the drop afterward can be stronger and come later. Name any words, topics or names that are off-limits.',
    top: ['Ask for the off-limits words and topics, and stay away from them.', 'Plan more aftercare than usual.', 'Check in the next day.']
  },
  control: {
    bottom: "Overstimulation is intense. Agree on a sign for \"too much\" that's different from your stop signal.",
    top: ['Agree on a "too much" sign that is different from the stop signal.', 'Check the fit and the skin under any chastity device.']
  },
  sensation: {
    top: ['Clamps hurt most when they come off: take them off slowly.']
  }
};

/** A Top's confirmation before turning on suspension or fire play. */
export const TRAINED_CONFIRM = "I've had hands-on training in this.";

/** On every CNC beat. */
export const CNC_SIGNALS = 'Signals always work, even in CNC. Any signal stops the scene.';

/** The health question, asked with the body notes. */
export const HEART_QUESTION = 'I have a pacemaker or another implanted device, a heart condition or epilepsy, or might be pregnant';

/** Hand check for rope, in place of the general circulation check. */
export const ropeHandCheck = 'Hand check: they squeeze your fingers and touch thumb to each fingertip. Any numbness, tingling or weakness: untie now.';
