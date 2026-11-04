import { aftercareMap, desireMap, quadrantOf, shadeOf } from './intake';

describe('map wording', () => {
  it('changes with how far into its quadrant the dot sits', () => {
    const [ignite] = desireMap.quadrants;
    expect(shadeOf(desireMap, { x: -0.3, y: 0.3 })).toBe(ignite.shades.inner);
    expect(shadeOf(desireMap, { x: -0.8, y: 0.3 })).toBe(ignite.shades.side);
    expect(shadeOf(desireMap, { x: -0.3, y: 0.8 })).toBe(ignite.shades.vertical);
    expect(shadeOf(desireMap, { x: -0.8, y: 0.8 })).toBe(ignite.shades.corner);
  });

  it('has four different lines for every quadrant', () => {
    for (const map of [desireMap, aftercareMap]) {
      for (const q of map.quadrants) expect(new Set(Object.values(q.shades)).size).toBe(4);
    }
    expect(quadrantOf(aftercareMap, { x: 0.9, y: -0.9 }).id).toBe('pillow-talk');
  });
});
