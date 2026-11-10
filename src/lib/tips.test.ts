import { bottomTips, topTips } from '../content/tips';
import { daysBetween, interleave, localDay, tipFor } from './tips';

describe('daily tips', () => {
  it('has the two starter libraries of 120, each a real sentence', () => {
    expect(topTips).toHaveLength(120);
    expect(bottomTips).toHaveLength(120);
    for (const t of [...topTips, ...bottomTips]) {
      expect(t.text.length).toBeGreaterThan(20);
    }
  });

  it('deals every tip once, themes taking turns, each theme in its own order', () => {
    const dealt = interleave(topTips);
    expect(new Set(dealt.map((t) => t.n)).size).toBe(120);
    expect(dealt[0].n).toBe(1);
    expect(dealt[1].theme).not.toBe(dealt[0].theme);
    const arc = dealt.filter((t) => t.theme === 'Arc').map((t) => t.n);
    expect(arc).toEqual([...arc].sort((a, b) => a - b));
  });

  it('starts at the first tip and moves one a day, across months and years', () => {
    expect(tipFor('top', '2026-11-10', '2026-11-10').day).toBe(1);
    expect(tipFor('bottom', '2026-11-10', '2026-11-11').day).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(tipFor('top', '2026-01-01', '2026-05-01').day).toBe(121 - 120);
    expect(daysBetween('2026-11-10', '2026-11-01')).toBe(0);
  });

  it('reads today in local time', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
