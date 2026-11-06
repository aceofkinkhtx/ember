import { wavePath, waveY } from './wave';

// The wave must never draw a beat as more or less intense than its neighbors allow.
describe('the scene map wave', () => {
  it('runs edge to edge through every beat without overshooting', () => {
    const pts = [
      { x: 10, y: 70 },
      { x: 40, y: 20 },
      { x: 60, y: 60 },
      { x: 90, y: 10 },
      { x: 120, y: 80 }
    ];
    const d = wavePath(pts, 130);
    expect(d.startsWith('M0,70')).toBe(true);
    expect(d.endsWith('130,80')).toBe(true);
    const ys = [...d.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...ys)).toBeLessThanOrEqual(80);
  });
});

describe('finding a spot on the wave', () => {
  it('passes through each beat and stays between its neighbors', () => {
    const pts = [
      { x: 20, y: 70 },
      { x: 60, y: 20 },
      { x: 100, y: 50 }
    ];
    for (const p of pts) expect(waveY(pts, 120, p.x)).toBeCloseTo(p.y, 5);
    const mid = waveY(pts, 120, 40);
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(70);
    expect(waveY(pts, 120, 0)).toBeCloseTo(70, 5);
  });
});
