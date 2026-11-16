// Positions and furniture for each section of a scene (Michael, Nov 16), and
// the positions a bottom says are hard for their body (asked in the intake).
// A choice is a built-in id, or "custom:" followed by the person's own words.

export interface Option {
  id: string;
  label: string;
}

export const positions: Option[] = [
  { id: 'standing', label: 'Standing' },
  { id: 'kneeling', label: 'Kneeling' },
  { id: 'all-fours', label: 'All fours' },
  { id: 'prone', label: 'Lying face down' },
  { id: 'supine', label: 'Lying on back' },
  { id: 'side', label: 'On their side' },
  { id: 'sitting', label: 'Sitting' },
  { id: 'over-knee', label: 'Over the knee' },
  { id: 'bent-over', label: 'Bent over' },
  { id: 'spread-eagle', label: 'Spread-eagle' }
];

export const furniture: Option[] = [
  { id: 'bench', label: 'Spanking bench' },
  { id: 'cross', label: 'St. Andrew’s cross' },
  { id: 'swing', label: 'Suspension swing' },
  { id: 'bed', label: 'Bed' },
  { id: 'floor', label: 'Floor or mat' },
  { id: 'massage-table', label: 'Massage table' },
  { id: 'chair', label: 'Chair' },
  { id: 'sling', label: 'Sling' },
  { id: 'wall', label: 'Wall or doorframe' }
];

const CUSTOM = 'custom:';

export const customChoice = (text: string) => CUSTOM + text.trim();
export const isCustom = (choice: string) => choice.startsWith(CUSTOM);

/** What to show for a stored choice. */
export function choiceLabel(list: Option[], choice: string | null | undefined): string | null {
  if (!choice) return null;
  if (isCustom(choice)) return choice.slice(CUSTOM.length);
  return list.find((o) => o.id === choice)?.label ?? null;
}

/** "Kneeling · Spanking bench", "Standing", "Bed", or null. */
export function setupLabel(setup: { position: string | null; furniture: string | null } | undefined): string | null {
  const p = choiceLabel(positions, setup?.position);
  const f = choiceLabel(furniture, setup?.furniture);
  if (p && f) return `${p} · ${f}`;
  return p ?? f;
}
