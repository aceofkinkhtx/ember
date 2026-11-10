import type { Role } from '../content/copy';
import { bottomTips, topTips, type Tip } from '../content/tips';

// One tip a day for each role (M8). The day count starts the first time tips
// are shown on this phone, so everyone begins at the start of the library.
// The themes take turns, so two days in a row rarely share a theme.

/** Deals the themes out in turns, keeping each theme's own order. */
export function interleave(tips: Tip[]): Tip[] {
  const themes = [...new Set(tips.map((t) => t.theme))];
  const queues = themes.map((theme) => tips.filter((t) => t.theme === theme));
  const out: Tip[] = [];
  while (out.length < tips.length) {
    for (const q of queues) {
      const next = q.shift();
      if (next) out.push(next);
    }
  }
  return out;
}

const order: Record<Role, Tip[]> = { top: interleave(topTips), bottom: interleave(bottomTips) };

/** Today on this phone, as YYYY-MM-DD in local time. */
export function localDay(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole days from one local date to another (never negative). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  return Math.max(0, Math.round(ms / 86400000));
}

/** The tip for a role on a given day, counting from the day tips started. */
export function tipFor(role: Role, startedOn: string, today: string): { tip: Tip; day: number; total: number } {
  const list = order[role];
  const day = daysBetween(startedOn, today) % list.length;
  return { tip: list[day], day: day + 1, total: list.length };
}
