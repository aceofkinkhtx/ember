// Wording and options for the bottom's intake (M2). Sources: product-spec.md
// (word groups, maps, decoder), intake-and-data-model.md (detailed sections),
// and Michael's decisions (spec/decisions.md).

export interface Word {
  id: string;
  label: string;
  desc: string;
}

export type GroupId = 'heat' | 'hold' | 'flow';

export const wordGroups: { id: GroupId; title: string; question: string; words: Word[] }[] = [
  {
    id: 'heat',
    title: 'Heat',
    question: 'What should it feel like?',
    words: [
      { id: 'smolder', label: 'Smolder', desc: 'A low, steady burn. Anticipation that simmers and never quite boils over.' },
      { id: 'blaze', label: 'Blaze', desc: 'Big, loud, full-bodied sensation. Turn it up.' },
      { id: 'velvet', label: 'Velvet', desc: 'Soft, luxurious, skin-forward pleasure. Lingering touch and indulgence.' },
      { id: 'electric', label: 'Electric', desc: 'Sharp and crackling. Nerves awake, adrenaline up, every touch a jolt.' },
      { id: 'feral', label: 'Feral', desc: 'Primal and untamed. Less polish, more instinct, a little messy.' },
      { id: 'mischief', label: 'Mischief', desc: 'Playful trouble. Grins, giggles, games and getting caught.' },
      { id: 'reverent', label: 'Reverent', desc: 'Sacred and devotional. Ceremony, weight and meaning in every gesture.' },
      { id: 'dreamy', label: 'Dreamy', desc: 'Floaty and hazy. Drifting toward an altered, faraway state.' }
    ]
  },
  {
    id: 'hold',
    title: 'Hold',
    question: 'How do you want us to connect?',
    words: [
      { id: 'cherish', label: 'Cherish me', desc: 'Tenderness first. I want to feel treasured and handled with care.' },
      { id: 'claim', label: 'Claim me', desc: 'Take me firmly, within what we agreed. I want to feel possessed.' },
      { id: 'command', label: 'Command me', desc: 'Clear instructions and protocol. Tell me what to do.' },
      { id: 'serve', label: 'Serve me', desc: 'Your focus is my pleasure. Attend to me and make it about my experience.' },
      { id: 'test', label: 'Test me', desc: 'Challenge me. Let me earn it, push me and see what I can take.' },
      { id: 'play', label: 'Play with me', desc: 'We meet as equals. Banter, games and tussling for the fun of it.' },
      { id: 'read', label: 'Read me', desc: 'Few words. Follow my body and answer what you see.' },
      { id: 'guide', label: 'Guide me', desc: 'Teach me as we go. Explain, encourage and help me learn.' }
    ]
  },
  {
    id: 'flow',
    title: 'Flow',
    question: 'How should it move?',
    words: [
      { id: 'slow-climb', label: 'Slow Climb', desc: 'One long, patient ascent to a single summit.' },
      { id: 'surge', label: 'Surge', desc: 'Start strong and peak early, then a long, easy descent.' },
      { id: 'ripple', label: 'Ripple', desc: 'Many small peaks with short breaths between them.' },
      { id: 'staircase', label: 'Staircase', desc: 'Step up, settle on a plateau, then step up again.' },
      { id: 'edge', label: 'Edge', desc: 'Approach the peak again and again without crossing it.' },
      { id: 'pulse', label: 'Pulse', desc: 'A steady, rhythmic repetition that turns hypnotic.' },
      { id: 'drift', label: 'Drift', desc: 'Unhurried and wandering, with no destination in mind.' },
      { id: 'storm', label: 'Storm', desc: 'Unpredictable. Sudden shifts, surprises and changes of weather.' }
    ]
  }
];

/** The desire decoder follows every word group (Michael, Nov 4, 2026). */
export const decoderAnswers: Word[] = [
  { id: 'rest', label: 'Rest from deciding', desc: 'Someone else holds the choices so I can let go of them.' },
  { id: 'desired', label: 'Feeling desired', desc: 'Being wanted, noticed and chosen.' },
  { id: 'purpose', label: 'Having a purpose', desc: 'Being useful, pleasing someone, doing something well.' },
  { id: 'sensation', label: 'Losing myself in sensation', desc: 'My body takes over and my thoughts go quiet.' },
  { id: 'release', label: 'Emotional release', desc: 'Letting out what I carry: tears, laughter, catharsis.' },
  { id: 'character', label: 'Playing a character', desc: 'Stepping into a role that is not my everyday self.' }
];

export interface MapSpec {
  id: 'desire' | 'aftercare';
  title: string;
  /** Left and right ends of the horizontal axis. */
  x: [string, string];
  /** Bottom and top ends of the vertical axis. */
  y: [string, string];
  /** Quadrants: top-left, top-right, bottom-left, bottom-right. */
  quadrants: [Quadrant, Quadrant, Quadrant, Quadrant];
}

/**
 * Each quadrant splits into four, and the wording follows where the dot sits:
 * near the middle, out along the side axis, out along the up and down axis, or
 * all the way into the corner.
 */
export interface Quadrant extends Word {
  shades: { inner: string; side: string; vertical: string; corner: string };
}

export const desireMap: MapSpec = {
  id: 'desire',
  title: 'Desire map',
  x: ['In my body', 'In my head'],
  y: ['Soothe me', 'Stir me'],
  quadrants: [
    { id: 'ignite', label: 'Ignite', desc: 'Sensation, intensity, adrenaline.',
      shades: {
        inner: 'A spark of sensation. Warm, awake and easy to build on.',
        side: 'Sensation first. Lots of touch and texture, at a steady pace.',
        vertical: 'Big energy and adrenaline, with your head in it too.',
        corner: 'All the way: strong sensation, real intensity and a rush of adrenaline.'
      }
    },
    { id: 'unravel', label: 'Unravel', desc: 'Psychological edge, catharsis, transformation.',
      shades: {
        inner: 'A little head play. Teasing the mind without going deep.',
        side: 'Deep in your head. Mind games and focus, more absorbing than wild.',
        vertical: 'A psychological charge with your body in it too. Tension that builds and breaks.',
        corner: 'All the way: a real psychological edge, catharsis and coming out changed.'
      }
    },
    { id: 'melt', label: 'Melt', desc: 'Comfort, warmth, sensual ease.',
      shades: {
        inner: 'Gentle, warm touch. Relaxed, with room for a little more.',
        side: 'Rich sensual touch. Skin, warmth and slow pleasure.',
        vertical: 'Deep comfort. Held and calmed, body and mind together.',
        corner: 'All the way: full sensual ease, melting into warmth and touch.'
      }
    },
    { id: 'drift', label: 'Drift', desc: 'Quiet mind, surrender, letting go.',
      shades: {
        inner: 'A calmer mind. Easing off the day without going far.',
        side: 'Focused surrender. Your mind lets go by following someone else.',
        vertical: 'Deep calm. Still, safe and slowly letting go.',
        corner: 'All the way: a quiet mind, full surrender and floating away.'
      }
    }
  ]
};

export const aftercareMap: MapSpec = {
  id: 'aftercare',
  title: 'Aftercare map',
  x: ['Quiet', 'Talk'],
  y: ['Nurture me', 'Ground me'],
  quadrants: [
    { id: 'anchor', label: 'Anchor', desc: 'Water, space nearby, steady presence.',
      shades: {
        inner: 'A little space and a glass of water, with you close by.',
        side: 'Silence and space. Stay near, and let me come back on my own.',
        vertical: 'Practical grounding. Water, a snack, feet on the floor, a few words.',
        corner: 'All the way: quiet, steady presence and plenty of grounding.'
      }
    },
    { id: 'recap', label: 'Recap', desc: 'Sit up, process, name what happened.',
      shades: {
        inner: 'A short check-in. A few words about how it went.',
        side: 'Talk it all through. What worked, what surprised us, how I feel.',
        vertical: 'Sit up and get steady first, then a little talk.',
        corner: 'All the way: sitting up, fully processing and naming everything that happened.'
      }
    },
    { id: 'cocoon', label: 'Cocoon', desc: 'Blanket, holding, silence.',
      shades: {
        inner: 'A blanket and a little closeness. Gentle and low-key.',
        side: 'Silence above all. Close and soft, with no need to talk.',
        vertical: 'Wrapped up and held tight, with a few soft words at most.',
        corner: 'All the way: blankets, holding and deep, cozy silence.'
      }
    },
    { id: 'pillow-talk', label: 'Pillow Talk', desc: 'Cuddled while we talk it through.',
      shades: {
        inner: 'Close together, with some easy, gentle conversation.',
        side: 'Lots of talk, side by side. Processing out loud and kept warm.',
        vertical: 'Held close and cared for, with soft words now and then.',
        corner: 'All the way: cuddled up tight, talking everything through.'
      }
    }
  ]
};

/** A dot on a map: x and y each run from -1 to 1, with 0 at the center. */
export interface Dot {
  x: number;
  y: number;
}

export function quadrantOf(map: MapSpec, dot: Dot): Quadrant {
  const [tl, tr, bl, br] = map.quadrants;
  if (dot.y >= 0) return dot.x < 0 ? tl : tr;
  return dot.x < 0 ? bl : br;
}

/** The wording for exactly where the dot sits inside its quadrant. */
export function shadeOf(map: MapSpec, dot: Dot): string {
  const { shades } = quadrantOf(map, dot);
  const far = (n: number) => Math.abs(n) >= 0.5;
  if (far(dot.x) && far(dot.y)) return shades.corner;
  if (far(dot.x)) return shades.side;
  if (far(dot.y)) return shades.vertical;
  return shades.inner;
}

/** Near the center reads as "a little of everything". */
export function nearCenter(dot: Dot): boolean {
  return Math.hypot(dot.x, dot.y) < 0.25;
}

export const honorifics = ['Sir', "Ma'am", 'Mx.', 'Daddy', 'Mommy', 'Master', 'Mistress', 'Boss', 'Captain', 'Coach', 'Use my name'];

export const triggerExamples = [
  'Being called certain names',
  'Hands near my throat',
  'Being held down',
  'Raised voices',
  'Being ignored',
  'Darkness',
  'Certain smells'
];

export const overwhelmExamples = [
  'Slow down and check in',
  'Hold me still and close',
  'Give me space',
  'Talk me through it softly',
  'Water and a blanket',
  'Stop and sit me up',
  "Don't leave me alone"
];

/** Places a person can mark for injuries or body notes. */
export const bodyAreas: { id: string; label: string; side: 'front' | 'back' }[] = [
  { id: 'head', label: 'Head', side: 'front' },
  { id: 'neck', label: 'Neck', side: 'front' },
  { id: 'shoulders', label: 'Shoulders', side: 'front' },
  { id: 'chest', label: 'Chest or breasts', side: 'front' },
  { id: 'arms', label: 'Arms', side: 'front' },
  { id: 'wrists-hands', label: 'Wrists and hands', side: 'front' },
  { id: 'belly', label: 'Belly', side: 'front' },
  { id: 'hips', label: 'Hips', side: 'front' },
  { id: 'genitals', label: 'Genitals', side: 'front' },
  { id: 'knees', label: 'Knees', side: 'front' },
  { id: 'ankles-feet', label: 'Ankles and feet', side: 'front' },
  { id: 'upper-back', label: 'Upper back', side: 'back' },
  { id: 'lower-back', label: 'Lower back', side: 'back' },
  { id: 'butt', label: 'Butt', side: 'back' },
  { id: 'thighs', label: 'Thighs', side: 'back' },
  { id: 'calves', label: 'Calves', side: 'back' }
];

export const presenceQuestions = [
  { id: 'video', label: 'Photos or video during the scene' },
  { id: 'watching', label: 'Others watching' },
  { id: 'joining', label: 'Others joining in' },
  { id: 'public', label: 'Scenes in public or at a party' }
] as const;

export type PresenceAnswer = 'yes' | 'ask' | 'no';
export const presenceAnswers: { id: PresenceAnswer; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'ask', label: 'Ask me first' },
  { id: 'no', label: 'No' }
];

export const contactAwareness = [
  { id: 'yes', label: 'They know I do kink' },
  { id: 'some', label: 'They know a little' },
  { id: 'no', label: "They don't know" }
] as const;

export const defaultSignals = { green: 'Green', yellow: 'Yellow', red: 'Red', handSign: 'Tap out three times' };
