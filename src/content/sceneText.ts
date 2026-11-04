import type { CategoryId } from '../data/activities';
import type { ArcShape } from '../lib/scene/model';

// Starter wording for designed scenes (M4). Every line is a starting point the
// Top edits in their own voice. Plain, specific, never explicit for its own sake.

export const shapes: Record<ArcShape, { label: string; desc: string }> = {
  climb: { label: 'One long climb', desc: 'A patient build to a single peak, then a slow way down.' },
  twin: { label: 'Two peaks', desc: 'A lighter first peak, a real rest, then a fuller second peak.' },
  waves: { label: 'Waves', desc: 'Three smaller peaks, each a little higher, with breaths between.' }
};

/** Which shape fits each Flow word best. */
export const shapeForFlow: Record<string, ArcShape> = {
  'slow-climb': 'climb',
  surge: 'climb',
  drift: 'climb',
  staircase: 'twin',
  storm: 'twin',
  ripple: 'waves',
  edge: 'waves',
  pulse: 'waves'
};

export type Stage = 'warmup' | 'build' | 'peak';

/** DO text for a step, by category and where it sits in the arc. */
export function doText(category: CategoryId, label: string, stage: Stage, restraint: boolean): string {
  const what = label.toLowerCase();
  if (restraint) return `Put on the ${what}. Check fit, circulation and that they can still signal.`;
  switch (category) {
    case 'impact':
      if (stage === 'warmup') return `Warm the skin with ${what}: light, even and rhythmic, on low-risk areas first.`;
      if (stage === 'build') return `${label} in steady sets, a little firmer each set. Pause between sets and read them.`;
      return `${label} at the agreed strength, in sets with short pauses. Watch their breath.`;
    case 'bondage':
      return `${label}. Keep it unhurried and check in once it's on.`;
    case 'sensation':
      return stage === 'peak' ? `${label}, fuller now, with pauses so it lands.` : `${label}, slowly at first, watching how they respond.`;
    case 'touch':
      return `${label}, unhurried and attentive.`;
    case 'penetration':
      return `${label}: plenty of lube, go at their pace and check in before more.`;
  }
}

export const sayFor: Record<Stage, string> = {
  warmup: "Breathe with me. Give me a color whenever you're ready.",
  build: "You're doing well. Tell me with your colors.",
  peak: 'Stay with me. Breathe.'
};

export const fixed = {
  arrival: {
    title: 'Arrive and settle',
    do: 'Greet them, settle into the space, and say the signals aloud together.',
    say: 'Take a breath with me. We have all the time we planned.'
  },
  warmup: { title: 'Warm up' },
  build: { title: 'Build' },
  peak: { title: 'Peak' },
  recovery: {
    title: 'Recover',
    do: 'Pause everything. Offer water, check skin and circulation, and stay in contact.',
    say: 'Look at me. How are you, in one word?'
  },
  descent: {
    title: 'Come down',
    do: 'Slow everything down: lighter touch, longer pauses, release any restraints.',
    say: 'We are coming down now.'
  },
  close: {
    title: 'Name what they did',
    do: 'Hold them still and name one specific, true thing you saw them do.',
    say: 'I saw what you did in there, and I am proud of you.',
    notes: 'Make it specific: one real thing, in your own words.'
  },
  immediate: { title: 'Right after', do: 'Stay close. Warmth, water and steady contact first.' },
  settled: { title: 'Settled', do: 'Once they are steady, follow their aftercare plan.' },
  closing: {
    title: 'Before they go',
    do: 'Check they are steady before they leave: water, food and a clear head. Agree on the next check-in time.',
    say: 'How are you getting home? I will check in with you tomorrow.'
  }
};

/** Aftercare by where the bottom put their aftercare dot. */
export const aftercareStyle: Record<string, string> = {
  anchor: 'Quiet and steady: water, space nearby, your calm presence.',
  recap: 'Sit up together and talk it through: what happened, how it felt.',
  cocoon: 'Blanket, holding and silence.',
  'pillow-talk': 'Cuddled close while you talk it through.'
};
