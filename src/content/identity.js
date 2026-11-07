// Pronouns and gender identity. Ember never assumes a male Top and female
// bottom, never infers anatomy from gender, and uses they/them until a person
// has said otherwise.
export const pronounSets = [
    { id: 'she', label: 'she/her', subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself', plural: false },
    { id: 'he', label: 'he/him', subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself', plural: false },
    { id: 'they', label: 'they/them', subject: 'they', object: 'them', possessive: 'their', reflexive: 'themself', plural: true }
];
/** Extra choices people often use alongside or instead of a single set. */
export const pronounChoices = [
    ...pronounSets.map((p) => ({ id: p.id, label: p.label })),
    { id: 'she-they', label: 'she/they' },
    { id: 'he-they', label: 'he/they' },
    { id: 'any', label: 'any pronouns' },
    { id: 'name', label: 'use my name' },
    { id: 'ask', label: 'ask me' }
];
export const genderIdentities = [
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
export const emptyIdentity = { name: '', pronouns: [], pronounsCustom: '', genders: [], genderCustom: '' };
const they = pronounSets[2];
/**
 * The pronoun set Ember uses when writing about someone. Mixed choices such
 * as she/they use the first set; "any", "ask me", "use my name" and custom
 * pronouns fall back to they/them, which is always respectful.
 */
export function pronounsFor(identity) {
    const first = identity?.pronouns[0];
    if (first === 'she' || first === 'she-they')
        return pronounSets[0];
    if (first === 'he' || first === 'he-they')
        return pronounSets[1];
    return they;
}
/** "she is", "they are" */
export function isAre(p) {
    return p.plural ? 'are' : 'is';
}
/** How someone's pronouns read on their profile, for example "she/they". */
export function pronounLabel(identity) {
    const labels = identity.pronouns.map((id) => pronounChoices.find((c) => c.id === id)?.label ?? id);
    if (identity.pronounsCustom.trim())
        labels.push(identity.pronounsCustom.trim());
    return labels.join(', ');
}
