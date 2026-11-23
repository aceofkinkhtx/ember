import { localDay } from './tips';

/**
 * The day a scene counts as "today" (Michael, Nov 23). It uses the phone's own
 * date, not UTC, and the day runs until 3am, so tonight's scene stays on Home
 * and in Upcoming through the night.
 */
export const SCENE_DAY_ENDS_HOUR = 3;

export function sceneDay(now = new Date()): string {
  return localDay(new Date(now.getTime() - SCENE_DAY_ENDS_HOUR * 3_600_000));
}
