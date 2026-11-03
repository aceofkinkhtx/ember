import { roleLabel, type Role } from './copy';

// The three check-ins around every scene (Michael, Nov 4, 2026). Each has
// three questions. The screens arrive in M6 (pre-scene) and M7 (after and
// follow-up); the wording lives here so it stays in one place.

export type CheckInKind = 'pre' | 'post' | 'followup';

export type Question =
  | { id: string; kind: 'scale'; prompt: string; low: string; high: string }
  | { id: string; kind: 'yesno'; prompt: string; noteIfYes?: string }
  | { id: string; kind: 'note'; prompt: string; hint: string };

/** The other person in the scene, named by their role. */
function partner(myRole: Role, discreet: boolean): string {
  return roleLabel(myRole === 'top' ? 'bottom' : 'top', discreet);
}

export function checkInQuestions(kind: CheckInKind, myRole: Role, discreet = false): Question[] {
  const them = partner(myRole, discreet);
  switch (kind) {
    case 'pre':
      return [
        { id: 'feeling', kind: 'scale', prompt: 'How are you feeling right now?', low: 'Not good', high: 'Great' },
        { id: 'final-negotiation', kind: 'yesno', prompt: 'Have you had your final pre-scene negotiation?' },
        { id: 'excitement', kind: 'scale', prompt: 'How excited are you for this scene?', low: 'Not at all', high: 'Very' }
      ];
    case 'post':
      return [
        { id: 'feeling', kind: 'scale', prompt: 'How are you feeling right now?', low: 'Not good', high: 'Great' },
        {
          id: 'attentiveness',
          kind: 'scale',
          prompt:
            myRole === 'bottom'
              ? `How attentive was your ${them} to you?`
              : `How responsive was your ${them} during the scene?`,
          low: 'Not at all',
          high: 'Completely'
        },
        { id: 'overall', kind: 'scale', prompt: 'Overall, how was the experience?', low: 'Poor', high: 'Wonderful' }
      ];
    case 'followup':
      return [
        { id: 'feeling', kind: 'scale', prompt: 'How are you feeling in body and mind?', low: 'Not good', high: 'Great' },
        {
          id: 'changed',
          kind: 'yesno',
          prompt: 'Has anything changed since the scene?',
          noteIfYes: 'What changed? (optional)'
        },
        { id: 'notes', kind: 'note', prompt: `Notes for your ${them}`, hint: 'Optional. Your answer is shared with them.' }
      ];
  }
}

/** The bottom's follow-ups: once a day for 3 days after the scene. */
export const FOLLOWUP_DAYS = 3;

/** A 1 or 2 on "how are you feeling" means extra care is offered. */
export const LOW_RATING = 2;

export type CareSuggestion = 'stay-longer' | 'reach-out' | null;

/**
 * Michael approved (Nov 4, 2026): a low feeling rating right after the scene
 * suggests staying together a little longer before heading home; a low rating
 * during the follow-up days offers an easy way to reach the Top or a friend.
 */
export function careSuggestion(kind: CheckInKind, feeling: number): CareSuggestion {
  if (feeling > LOW_RATING) return null;
  if (kind === 'post') return 'stay-longer';
  if (kind === 'followup') return 'reach-out';
  return null;
}

export const careText: Record<Exclude<CareSuggestion, null>, string> = {
  'stay-longer': "It sounds like you could use a little more time. Stay together a while longer before heading home, and don't drive until you feel steady.",
  'reach-out': "Drop can feel heavy, and it passes. Would you like to message your partner or a friend you trust? Reaching out is a good idea."
};
