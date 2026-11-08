import { roleLabel } from './copy';

// After the scene (M7): the debrief wording for both people. The three-question
// check-ins (post and follow-up) live in checkins.ts.

export interface DebriefScale {
  id: string;
  prompt: string;
  low: string;
  high: string;
  /** Kept just for the person answering, never shared. */
  private?: boolean;
}

/** A2, the Top's debrief: six questions, sliders with optional notes, any can be skipped. */
export function topDebrief(discreet = false): DebriefScale[] {
  const them = roleLabel('bottom', discreet);
  return [
    { id: 'authentic', prompt: 'How real did the scene feel, for both of you?', low: 'Forced', high: 'Completely real' },
    { id: 'communicative', prompt: 'How well did you two communicate during it?', low: 'Not well', high: 'Very well' },
    { id: 'exploratory', prompt: 'How much new ground did you explore?', low: 'Stayed familiar', high: 'A lot' },
    { id: 'mattering', prompt: `Did your ${them} seem to feel seen, and that they mattered?`, low: 'Not really', high: 'Clearly' },
    { id: 'self', prompt: 'And you: how are you doing now?', low: 'Not good', high: 'Great', private: true }
  ];
}

/** What the Top noticed about each activity; shared with the bottom as a suggestion, never a change. */
export const topReactions = [
  { id: 'loved', label: 'They loved it' },
  { id: 'more-care', label: 'Needs more care next time' },
  { id: 'not-for-them', label: "Didn't seem right for them" }
] as const;
export type TopReaction = (typeof topReactions)[number]['id'];

/** BA1, the bottom's debrief. */
export function bottomDebrief(discreet = false): DebriefScale[] {
  const top = roleLabel('top', discreet);
  return [
    { id: 'feel-now', prompt: 'How do you feel now?', low: 'Not good', high: 'Great' },
    { id: 'seen', prompt: `Did you feel seen by your ${top}, and that you mattered?`, low: 'Not really', high: 'Completely' }
  ];
}

/** The bottom's one-tap replies, per activity. */
export const bottomReplies = [
  { id: 'again', label: 'Loved that, again please' },
  { id: 'another-way', label: 'Yes to this, but another way' },
  { id: 'no-now', label: "That's a no for me now" },
  { id: 'talk', label: "Something felt off, let's talk" }
] as const;
export type BottomReply = (typeof bottomReplies)[number]['id'];

/** A suggested check-in message in the Top's voice, about 18 hours later. */
export function checkInMessage(name: string): string {
  const hello = name ? `Hey ${name}.` : 'Hey.';
  return `${hello} Checking in after our time together. How are you feeling in your body and in your head today? Anything you need from me?`;
}

/** Generic alert text. It never names a person, a scene or an act. */
export const alertText = {
  checkin: 'A check-in is waiting in Ember.',
  message: 'You have a new message in Ember.'
};
