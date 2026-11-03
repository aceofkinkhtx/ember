// Support Ember: donation handles and the once-a-month prompt.

export const donation = {
  cashApp: { handle: '$michaelchapter4' },
  venmo: { handle: '@MichaelPBrown1', user: 'MichaelPBrown1' },
  zelle: { handle: 'aceofkinkhtx@gmail.com' }
};

export const donationAmounts = [5, 10, 20, 50];
export const MIN_DONATION = 5;

export function cashAppUrl(amount: number): string {
  return `https://cash.app/${donation.cashApp.handle}/${amount}`;
}

/** No note is prefilled: Venmo notes can be public, so Ember stays out of them. */
export function venmoUrl(amount: number): string {
  return `https://venmo.com/?txn=pay&recipients=${donation.venmo.user}&amount=${amount}`;
}

const DAY = 24 * 60 * 60 * 1000;
/** First prompt a week after setup, then once a month. */
export const FIRST_PROMPT_AFTER_DAYS = 7;
export const PROMPT_EVERY_DAYS = 30;

export function donationPromptDue(now: Date, setupAt: string | null, lastPromptAt: string | null): boolean {
  if (!setupAt) return false;
  if (lastPromptAt) return now.getTime() - new Date(lastPromptAt).getTime() >= PROMPT_EVERY_DAYS * DAY;
  return now.getTime() - new Date(setupAt).getTime() >= FIRST_PROMPT_AFTER_DAYS * DAY;
}
