import { describe, expect, it } from 'vitest';
import { countdown } from '../components/scene/NextScene';
import { sceneDay } from './sceneDay';

describe('sceneDay', () => {
  it('uses the local date, not UTC, in the evening', () => {
    expect(sceneDay(new Date(2026, 10, 23, 19, 30))).toBe('2026-11-23');
    expect(sceneDay(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
  });
  it('keeps the day going until 3am', () => {
    expect(sceneDay(new Date(2026, 10, 24, 2, 59))).toBe('2026-11-23');
    expect(sceneDay(new Date(2026, 10, 24, 3, 0))).toBe('2026-11-24');
  });
  it('still says Today after midnight for last night\'s scene', () => {
    expect(countdown('2026-11-23', new Date(2026, 10, 24, 1, 0))).toBe('Today');
    expect(countdown('2026-11-25', new Date(2026, 10, 23, 20, 0))).toBe('In 2 days');
  });
});
