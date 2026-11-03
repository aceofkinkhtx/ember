import { cashAppUrl, donationPromptDue, venmoUrl } from './support';

const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString();

describe('monthly donation prompt', () => {
  it('waits a week after setup before the first prompt', () => {
    expect(donationPromptDue(new Date(day(6)), day(0), null)).toBe(false);
    expect(donationPromptDue(new Date(day(7)), day(0), null)).toBe(true);
  });

  it('asks at most once a month after that', () => {
    expect(donationPromptDue(new Date(day(36)), day(0), day(7))).toBe(false);
    expect(donationPromptDue(new Date(day(37)), day(0), day(7))).toBe(true);
  });

  it('never asks during onboarding', () => {
    expect(donationPromptDue(new Date(day(100)), null, null)).toBe(false);
  });

  it('prefills the amount and keeps Ember out of payment notes', () => {
    expect(cashAppUrl(10)).toBe('https://cash.app/$michaelchapter4/10');
    expect(venmoUrl(5)).toContain('amount=5');
    expect(venmoUrl(5)).not.toMatch(/note=/);
  });
});
