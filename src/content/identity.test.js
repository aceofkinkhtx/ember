import { emptyIdentity, isAre, pronounLabel, pronounsFor } from './identity';
describe('pronouns', () => {
    it('uses they/them until someone says otherwise', () => {
        expect(pronounsFor(null).subject).toBe('they');
        expect(pronounsFor(emptyIdentity).possessive).toBe('their');
    });
    it('uses the first set someone picked', () => {
        expect(pronounsFor({ pronouns: ['she'] }).object).toBe('her');
        expect(pronounsFor({ pronouns: ['he-they'] }).subject).toBe('he');
    });
    it('respects any, ask me, use my name and custom with they/them', () => {
        expect(pronounsFor({ pronouns: ['any'] }).subject).toBe('they');
        expect(pronounsFor({ pronouns: ['ask'] }).subject).toBe('they');
        expect(pronounsFor({ pronouns: ['name'] }).subject).toBe('they');
    });
    it('agrees the verb with the pronoun', () => {
        expect(isAre(pronounsFor({ pronouns: ['they'] }))).toBe('are');
        expect(isAre(pronounsFor({ pronouns: ['she'] }))).toBe('is');
    });
    it('shows custom pronouns in the person’s own words', () => {
        expect(pronounLabel({ pronouns: ['they'], pronounsCustom: 'xe/xem' })).toBe('they/them, xe/xem');
    });
});
