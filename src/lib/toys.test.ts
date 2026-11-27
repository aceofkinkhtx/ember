import { describe, expect, it } from 'vitest';
import { emptyToy, MAX_PHOTOS, photosOf, playTypes } from './toys';
import { checkInHoursOf, defaultTopSettings } from '../content/topSetup';

// Gear can have several photos (Michael, Nov 26); gear saved before then keeps its one.
describe('gear photos and kinds of play', () => {
  it('reads an older single photo as the first of several', () => {
    expect(photosOf(emptyToy())).toEqual([]);
    expect(photosOf({ ...emptyToy(), photoGen: 2 })).toEqual([{ id: '', gen: 2 }]);
    const many = [{ id: '', gen: 1 }, { id: 'a1b2c3d4', gen: 1 }];
    expect(photosOf({ ...emptyToy(), photoGen: 1, photos: many })).toEqual(many);
    expect(MAX_PHOTOS).toBe(6);
  });

  it('offers rope, electro and temperature, with More last', () => {
    const ids = playTypes.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['rope', 'electro', 'temperature']));
    expect(ids[ids.length - 1]).toBe('more');
  });
});

describe('check-in reminder hours', () => {
  it('defaults to 12 hours, also for settings saved before the choice existed', () => {
    expect(checkInHoursOf(defaultTopSettings())).toBe(12);
    expect(checkInHoursOf({})).toBe(12);
    expect(checkInHoursOf({ checkInHours: 24 })).toBe(24);
  });
});
