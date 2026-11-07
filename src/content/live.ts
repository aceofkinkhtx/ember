// Wording for Live Scene Mode (M6), kept in one place. Short, calm and
// readable in the dark with one hand.

/** The regulation toolkit: four groups of one-tap prompts, for both people. */
export const toolkit: { id: string; label: string; prompts: { title: string; text: string }[] }[] = [
  {
    id: 'body',
    label: 'Body',
    prompts: [
      { title: 'Breath', text: 'Breathe in for four, hold for four, out for six. Do it together, three times.' },
      { title: 'Contact', text: 'A steady hand on the back, chest or shoulder. Firm, still, warm.' },
      { title: 'Stillness', text: 'Everything stops for a moment. No new sensation. Just be here together.' }
    ]
  },
  {
    id: 'mind',
    label: 'Mind',
    prompts: [
      { title: 'Anchor phrase', text: 'Say the anchor slowly: "I\'m here. You\'re safe. We go at your pace."' },
      { title: 'Focus point', text: 'Find one thing to notice: the sound of a voice, a hand, the floor underneath.' }
    ]
  },
  {
    id: 'emotion',
    label: 'Emotion',
    prompts: [
      { title: 'Name it', text: 'Say what\'s there in one word, no fixing: scared, sad, full, floaty, angry.' },
      { title: 'Let it move', text: 'Tears, shaking and laughter are all welcome. Let it pass through; stay close.' }
    ]
  },
  {
    id: 'support',
    label: 'Support',
    prompts: [
      { title: 'Check in', text: 'Ask simply: "Color?" Then: "What do you need right now?"' },
      { title: 'Slow down', text: 'Halve the pace and the intensity. Stay there until things feel steady.' },
      { title: 'Adjust', text: 'Change what isn\'t working: position, pressure, words, or move to the next beat.' }
    ]
  }
];

/** The red screen: what to do, in order. */
export const redSteps = [
  'Stop everything now. Say: "I heard you. We\'re stopping."',
  'Release any restraint. Use the safety shears if a knot or buckle is slow.',
  'Check breathing, color and responses. Help them sit up slowly.',
  'Stay close and speak softly. Water and a blanket.',
  'Ask what they need. Follow their aftercare and overwhelm plan below.'
];

export const firstAid = [
  'Not breathing or not responding: call 911 and start CPR.',
  'Numb, cold or blue hands or feet: release restraints, warm and rub gently, and watch for 30 minutes.',
  'Faint or dizzy: lie them down with legs raised, and give water once steady.',
  'Bleeding: firm pressure with a clean cloth for 10 minutes.'
];

export const circulationCheck = 'Check circulation: fingers and toes warm and pink, they can wiggle them, no numbness or tingling.';

/** What the bottom sees on their phone during the scene. */
export const bottomLive = {
  intro: 'Your phone can stay close. Your words and signals work best: say them out loud. These buttons are a backup.',
  red: 'Red',
  yellow: 'Yellow',
  redSent: 'Red sent to your Top\'s phone. Everything stops. Say it out loud too.',
  yellowSent: 'Yellow sent. Your Top will slow down and check in.',
  offline: 'This phone is offline. Say your signal out loud.'
};
