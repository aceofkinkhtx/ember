// Pronouns and gender identity. Ember never assumes a male Top and female
// bottom, never infers anatomy from gender, and uses they/them until a person
// has said otherwise.

export interface PronounSet {
  id: string;
  label: string;
  subject: string; // they
  object: string; // them
  possessive: string; // their
  reflexive: string; // themself
  /** "they are" vs "she is" */
  plural: boolean;
}

export const pronounSets: PronounSet[] = [
  { id: 'she', label: 'she/her', subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself', plural: false },
  { id: 'he', label: 'he/him', subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself', plural: false },
  { id: 'they', label: 'they/them', subject: 'they', object: 'them', possessive: 'their', reflexive: 'themself', plural: true }
];

/** Extra choices people often use alongside or instead of a single set. */
export const pronounChoices: { id: string; label: string }[] = [
  ...pronounSets.map((p) => ({ id: p.id, label: p.label })),
  { id: 'she-they', label: 'she/they' },
  { id: 'he-they', label: 'he/they' },
  { id: 'any', label: 'any pronouns' },
  { id: 'name', label: 'use my name' },
  { id: 'ask', label: 'ask me' }
];

export const genderIdentities: string[] = [
  'Woman',
  'Man',
  'Nonbinary',
  'Trans',
  'Genderfluid',
  'Genderqueer',
  'Agender',
  'Two-Spirit',
  'Questioning'
];

export interface Identity {
  /** What they want to be called. */
  name: string;
  /** Ids from pronounChoices, in the order picked. */
  pronouns: string[];
  /** Their own words, if none of the choices fit. */
  pronounsCustom: string;
  /** Any number of identities; optional. */
  genders: string[];
  genderCustom: string;
}

export const emptyIdentity: Identity = { name: '', pronouns: [], pronounsCustom: '', genders: [], genderCustom: '' };

const they = pronounSets[2];

/**
 * The pronoun set Ember uses when writing about someone. Mixed choices such
 * as she/they use the first set; "any", "ask me", "use my name" and custom
 * pronouns fall back to they/them, which is always respectful.
 */
export function pronounsFor(identity: Pick<Identity, 'pronouns'> | null | undefined): PronounSet {
  const first = identity?.pronouns[0];
  if (first === 'she' || first === 'she-they') return pronounSets[0];
  if (first === 'he' || first === 'he-they') return pronounSets[1];
  return they;
}

/** "she is", "they are" */
export function isAre(p: PronounSet): string {
  return p.plural ? 'are' : 'is';
}

/** How someone's pronouns read on their profile, for example "she/they". */
export function pronounLabel(identity: Pick<Identity, 'pronouns' | 'pronounsCustom'>): string {
  const labels = identity.pronouns.map((id) => pronounChoices.find((c) => c.id === id)?.label ?? id);
  if (identity.pronounsCustom.trim()) labels.push(identity.pronounsCustom.trim());
  return labels.join(', ');
}
