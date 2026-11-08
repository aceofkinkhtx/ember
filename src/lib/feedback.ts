import { AccountError, db } from './account';
import { readJson, writeJson } from './storage';

// Beta feedback: plain answers that only Michael reads, in the Supabase
// dashboard. Unsent answers wait on this phone so nothing is lost.

export const APP_VERSION = '0.1';
export const FEEDBACK_DRAFT = 'ember.feedbackDraft';

export type Answer = string | number | string[];
/** Answers by section, then by question. "about" holds the tester's details. */
export type Answers = Record<string, Record<string, Answer>>;

export interface FeedbackDraft {
  feedback: Answers;
  problem: Record<string, Answer>;
}

export const emptyDraft = (): FeedbackDraft => ({ feedback: {}, problem: {} });

export const loadFeedbackDraft = (): FeedbackDraft => ({ ...emptyDraft(), ...readJson<FeedbackDraft>(FEEDBACK_DRAFT) });
export const saveFeedbackDraft = (d: FeedbackDraft) => writeJson(FEEDBACK_DRAFT, d);

const filled = (a: Answer | undefined) => (Array.isArray(a) ? a.length > 0 : typeof a === 'string' ? a.trim() !== '' : a !== undefined);

/** Drops empty answers and sections, so only what was said is sent. */
export function trimAnswers(answers: Record<string, Answer>): Record<string, Answer> {
  return Object.fromEntries(Object.entries(answers).filter(([, a]) => filled(a)).map(([k, a]) => [k, typeof a === 'string' ? a.trim() : a]));
}

export function trimAll(answers: Answers): Answers {
  return Object.fromEntries(
    Object.entries(answers)
      .map(([k, v]) => [k, trimAnswers(v)] as const)
      .filter(([, v]) => Object.keys(v).length > 0)
  );
}

export async function sendFeedback(kind: 'feedback' | 'problem', answers: unknown): Promise<void> {
  const { error } = await db.from('beta_feedback').insert({ kind, answers, app_version: APP_VERSION });
  if (error) throw new AccountError("Ember couldn't send that. Your answers are still here. Please try again.");
}
