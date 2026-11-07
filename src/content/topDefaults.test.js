import { aftercareMinutes } from './topDefaults';
describe('aftercare length', () => {
    it('defaults to 25% of a regular scene', () => {
        expect(aftercareMinutes(120, false)).toBe(30);
    });
    it('uses 33% for intense scenes', () => {
        expect(aftercareMinutes(180, true)).toBe(59);
    });
    it('never goes below 30 minutes for an intense scene', () => {
        expect(aftercareMinutes(60, true)).toBe(30);
        expect(aftercareMinutes(180, true, 5)).toBe(30);
    });
});
