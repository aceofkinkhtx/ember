import { clampPlacement, coverScale, cropRect, startPlacement, zoomAround } from './photo';

describe('placing a picture in its circle', () => {
  const frame = 280;

  it('starts centred, just covering the frame', () => {
    const p = startPlacement(1000, 500, frame);
    expect(p.scale).toBeCloseTo(0.56);
    expect(p.y).toBe(0);
    expect(p.x).toBeCloseTo((280 - 560) / 2);
    const r = cropRect(p, frame);
    expect([r.sx, r.sy, r.size].map((v) => Math.round(v) + 0)).toEqual([250, 0, 500]);
  });

  it('never leaves an empty edge inside the frame', () => {
    const p = clampPlacement({ x: 50, y: -999, scale: 0.1 }, 1000, 500, frame);
    expect(p.scale).toBe(coverScale(1000, 500, frame));
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('zooms around the pinch point, and not below covering the frame', () => {
    const start = startPlacement(800, 800, frame);
    const zoomed = zoomAround(start, start.scale * 2, 140, 140, 800, 800, frame);
    const z = cropRect(zoomed, frame);
    expect([z.sx, z.sy, z.size].map((v) => Math.round(v) + 0)).toEqual([200, 200, 400]);
    expect(zoomAround(zoomed, 0.01, 0, 0, 800, 800, frame).scale).toBe(start.scale);
  });
});
