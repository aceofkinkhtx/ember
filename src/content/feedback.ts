// Beta feedback (Michael, Nov 8): questions on each feature, with what to try
// first. Answers are plain text that only Michael reads, so the page says so.

export type Who = 'all' | 'top' | 'bottom';

export type Question =
  | { id: string; kind: 'scale'; prompt: string; low: string; high: string }
  | { id: string; kind: 'text'; prompt: string; hint?: string }
  | { id: string; kind: 'one'; prompt: string; options: string[] }
  | { id: string; kind: 'many'; prompt: string; options: string[] };

export interface FeedbackSection {
  id: string;
  title: string;
  who: Who;
  /** What to try before answering. */
  tryThis: string[];
  questions: Question[];
}

export const tried = ['Yes', 'Partly', 'Not yet'];

export const aboutYou: Question[] = [
  { id: 'roles', kind: 'many', prompt: 'I tested as', options: ['Top', 'bottom', 'S/switch'] },
  { id: 'experience', kind: 'one', prompt: 'My experience with kink', options: ['New to it', 'Some experience', 'Experienced', 'I play professionally'] },
  { id: 'with', kind: 'one', prompt: 'I tested with', options: ['A real partner', 'A friend helping test', 'By myself'] },
  { id: 'phone', kind: 'one', prompt: 'My phone', options: ['iPhone', 'Android', 'A computer', 'Other'] },
  { id: 'installed', kind: 'one', prompt: 'I used Ember', options: ['From my Home Screen', 'In the browser', 'Both'] }
];

const confusing: Question = { id: 'confusing', kind: 'text', prompt: 'Anything confusing, slow or broken here?', hint: 'Which screen, what you tapped, and what happened.' };

export const feedbackSections: FeedbackSection[] = [
  {
    id: 'start',
    title: 'Getting started and connecting',
    who: 'all',
    tryThis: [
      'Add Ember to your Home Screen and go through the welcome.',
      'Create your account and save your recovery code.',
      'Connect with someone using an invite link, a guest link or a personal code.'
    ],
    questions: [
      { id: 'ease', kind: 'scale', prompt: 'How easy was it to get set up?', low: 'Very confusing', high: 'Effortless' },
      { id: 'how', kind: 'many', prompt: 'How did you connect?', options: ['Invite link', 'Guest link', 'Personal code', "I didn't connect yet"] },
      { id: 'privacy', kind: 'scale', prompt: 'How clear was the privacy setup (discreet mode and PIN)?', low: 'Unclear', high: 'Very clear' },
      { id: 'stuck', kind: 'text', prompt: 'Where did you hesitate or get stuck?' }
    ]
  },
  {
    id: 'profile',
    title: 'Your profile (bottom)',
    who: 'bottom',
    tryThis: [
      'Fill in the essentials: safe words, limits, health notes.',
      'Share what you want in at least one way: the word groups, the desire map or the detailed list.',
      'Set your aftercare map, then choose what each partner sees.'
    ],
    questions: [
      { id: 'ways', kind: 'many', prompt: 'Which did you use?', options: ['Word groups', 'Desire map', 'Detailed list', 'Aftercare map'] },
      { id: 'want', kind: 'scale', prompt: 'How well could you say what you actually want?', low: 'Not at all', high: 'Exactly' },
      { id: 'limits', kind: 'scale', prompt: 'How in control of your limits did you feel?', low: 'Not at all', high: 'Completely' },
      { id: 'sharing', kind: 'scale', prompt: 'How clear were the sharing choices (nothing, safety essentials, everything)?', low: 'Unclear', high: 'Very clear' },
      { id: 'missing', kind: 'text', prompt: "Anything you wanted to say but couldn't find a place for?" },
      { id: 'words', kind: 'text', prompt: 'Any activity or word that was missing, or worded in a way that felt off?' },
      confusing
    ]
  },
  {
    id: 'setup',
    title: 'Your setup and gear (Top)',
    who: 'top',
    tryThis: [
      'In Me, set what you offer and how far you go in each kind of play.',
      'Rename an activity in your own words (press and hold it).',
      'Set your aftercare share and your voice in Top settings.',
      'Add gear with a photo and tags, and share your gear with a partner.'
    ],
    questions: [
      { id: 'ease', kind: 'scale', prompt: 'How easy was setting up what you offer?', low: 'Very hard', high: 'Very easy' },
      { id: 'scale', kind: 'scale', prompt: 'Does the 1 to 10 scale match how you think about intensity?', low: 'Not at all', high: 'Perfectly' },
      { id: 'gear', kind: 'scale', prompt: 'How easy was adding gear (photo and tags)?', low: 'Very hard', high: 'Very easy' },
      { id: 'missing', kind: 'text', prompt: 'Any kinds of play, activities or gear types missing?' },
      confusing
    ]
  },
  {
    id: 'design',
    title: 'Designing a scene',
    who: 'all',
    tryThis: [
      'Tops: start a new scene with a partner, pick activities and compare the starting designs. Try "Build your own" too.',
      'In the editor: drag a step, change a section\'s timing, add gear to a section, and read any flags.',
      'bottoms: design a scene for your Top and send it as a request.'
    ],
    questions: [
      { id: 'used', kind: 'many', prompt: 'What did you use?', options: ['A starting design as it was', 'A starting design I changed', 'Build your own', 'A request from my bottom', 'A request to my Top'] },
      { id: 'quality', kind: 'scale', prompt: 'How good were the starting designs?', low: 'Not usable', high: 'Ready to run' },
      { id: 'editor', kind: 'scale', prompt: 'How easy was the editor (dragging, timing, adding)?', low: 'Very hard', high: 'Very easy' },
      { id: 'flags', kind: 'scale', prompt: 'Did the safety flags and warnings make sense?', low: 'Not at all', high: 'Completely' },
      { id: 'blocked', kind: 'one', prompt: 'Did a safety rule ever stop something you had already negotiated?', options: ['Yes', 'No', 'Not sure'] },
      { id: 'blockedWhat', kind: 'text', prompt: 'If so, what was it?' },
      { id: 'fiddly', kind: 'text', prompt: 'What took longest, or felt fiddly?' },
      confusing
    ]
  },
  {
    id: 'vibe',
    title: 'SceneVibe and plans',
    who: 'all',
    tryThis: [
      'Tops: share a SceneVibe, with at least one surprise.',
      'bottoms: open the SceneVibe, read its colors, shapes and question marks, and ask to see the full plan.'
    ],
    questions: [
      { id: 'feel', kind: 'scale', prompt: 'How well did the SceneVibe give a feel for the scene?', low: 'Not at all', high: 'Very well' },
      { id: 'read', kind: 'scale', prompt: 'How easy were the colors, shapes and question marks to read?', low: 'Very hard', high: 'Very easy' },
      { id: 'surprises', kind: 'one', prompt: 'Did keeping surprises hidden feel right?', options: ['Yes', 'No', 'Mixed'] },
      confusing
    ]
  },
  {
    id: 'live',
    title: 'Pre-scene check and Live Scene Mode',
    who: 'all',
    tryThis: [
      'Run the pre-scene check together. A short practice scene is fine.',
      'Tops: run the scene with the live guide (DO, SAY, WATCH, NOTES), the timers, pause and the quick log.',
      'bottoms: follow the wave on your phone, and in a practice scene try Yellow and Red.'
    ],
    questions: [
      { id: 'check', kind: 'scale', prompt: 'How did the pre-scene check feel?', low: 'Too long', high: 'Just right' },
      { id: 'guide', kind: 'scale', prompt: 'How easy was the live guide to follow, one-handed?', low: 'Very hard', high: 'Very easy' },
      { id: 'dark', kind: 'scale', prompt: 'How readable was it in a dim room?', low: 'Unreadable', high: 'Easy to read' },
      { id: 'red', kind: 'one', prompt: 'Did you try Red or Yellow from the bottom\'s phone?', options: ['Yes, it reached the other phone', "Yes, but it didn't arrive", 'No'] },
      { id: 'needed', kind: 'text', prompt: "Anything you needed mid-scene that wasn't there?" },
      { id: 'pulled', kind: 'text', prompt: 'Did anything pull you out of the moment?' },
      confusing
    ]
  },
  {
    id: 'after',
    title: 'After the scene',
    who: 'all',
    tryThis: [
      'Answer the check-in right after the scene, then the debrief.',
      'Answer the follow-ups on days 1, 2 and 3.',
      'Tops: send the 18-hour check-in. bottoms: try a one-tap reply like "That\'s a no for me now".'
    ],
    questions: [
      { id: 'caring', kind: 'scale', prompt: 'How did the check-ins feel?', low: 'Cold or clinical', high: 'Caring' },
      { id: 'debrief', kind: 'scale', prompt: 'How useful were the debrief questions?', low: 'Not useful', high: 'Very useful' },
      { id: 'timing', kind: 'one', prompt: 'The number of reminders was', options: ['Too many', 'About right', 'Too few'] },
      { id: 'badMoment', kind: 'text', prompt: 'Did a reminder ever come at a bad moment? When?' },
      confusing
    ]
  },
  {
    id: 'messages',
    title: 'Messages and phone alerts',
    who: 'all',
    tryThis: [
      'Send a few messages to a connection, and unsend one.',
      'In Me, turn on alerts on this phone (on iPhone, from the Home Screen app), then have someone message you.',
      'With a test partner, try block and unblock.'
    ],
    questions: [
      { id: 'alerts', kind: 'one', prompt: 'Did phone alerts arrive?', options: ['Yes, quickly', 'Yes, but late', 'No', "I didn't turn them on"] },
      { id: 'discreet', kind: 'scale', prompt: 'Was the alert text discreet enough?', low: 'Not at all', high: 'Completely' },
      { id: 'want', kind: 'text', prompt: 'What else would you want in messages?' },
      confusing
    ]
  },
  {
    id: 'privacy',
    title: 'Privacy and safety',
    who: 'all',
    tryThis: [
      'Set a PIN, and try Face ID or fingerprint unlock if your phone has it.',
      'Turn discreet mode on and look around.',
      'In Me, try "Download my data". (Only delete your account when you are done testing.)'
    ],
    questions: [
      { id: 'safe', kind: 'scale', prompt: 'How safe did you feel putting personal details in Ember?', low: 'Not safe', high: 'Completely safe' },
      { id: 'who', kind: 'scale', prompt: 'How clear was who can see what?', low: 'Unclear', high: 'Very clear' },
      { id: 'biometric', kind: 'one', prompt: 'Face ID or fingerprint unlock', options: ['Worked', "Didn't work", "My phone doesn't have it", "Didn't try"] },
      { id: 'worry', kind: 'text', prompt: 'Did anything worry you about privacy or safety?' },
      confusing
    ]
  },
  {
    id: 'overall',
    title: 'Overall',
    who: 'all',
    tryThis: [],
    questions: [
      { id: 'keep', kind: 'scale', prompt: 'How likely are you to keep using Ember?', low: 'Not likely', high: 'Definitely' },
      { id: 'recommend', kind: 'scale', prompt: 'How likely are you to recommend it to someone in the scene?', low: 'Not likely', high: 'Definitely' },
      { id: 'best', kind: 'text', prompt: 'The best thing about Ember' },
      { id: 'fix', kind: 'text', prompt: 'The one thing to fix first' },
      { id: 'missing', kind: 'text', prompt: 'Anything you expected that is missing?' },
      { id: 'pay', kind: 'one', prompt: 'If advanced features cost something someday, would you', options: ['Pay for them', 'Maybe pay', 'Rather donate', 'Only use it free'] },
      { id: 'else', kind: 'text', prompt: 'Anything else for Michael?' }
    ]
  }
];

export const problemQuestions: Question[] = [
  { id: 'where', kind: 'one', prompt: 'Where was it?', options: [...feedbackSections.filter((s) => s.id !== 'overall').map((s) => s.title), 'Somewhere else'] },
  { id: 'doing', kind: 'text', prompt: 'What were you doing?', hint: 'For example: "Dragging a step in the editor."' },
  { id: 'happened', kind: 'text', prompt: 'What happened?' },
  { id: 'expected', kind: 'text', prompt: 'What did you expect instead?' },
  { id: 'how', kind: 'one', prompt: 'How bad was it?', options: ['It stopped me', 'Annoying', 'Small'] },
  { id: 'again', kind: 'one', prompt: 'Can you make it happen again?', options: ['Yes, every time', 'Sometimes', 'No', "Didn't try"] },
  { id: 'phone', kind: 'one', prompt: 'My phone', options: ['iPhone', 'Android', 'A computer', 'Other'] }
];

export const feedbackPrivacy =
  "Feedback isn't locked like the rest of Ember: Michael reads it as written, to improve the app. Please leave out real names and anyone's private details.";

/** Which sections a tester sees, from the roles they tested as. */
export function sectionsFor(roles: string[]): FeedbackSection[] {
  const top = roles.includes('Top') || roles.includes('S/switch');
  const bottom = roles.includes('bottom') || roles.includes('S/switch');
  if (!top && !bottom) return feedbackSections;
  return feedbackSections.filter((s) => s.who === 'all' || (s.who === 'top' ? top : bottom));
}
