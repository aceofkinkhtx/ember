// The scene map's smooth wave (Michael's choice B, Nov 6): one point at the
// middle of each beat, joined by a gentle curve that never overshoots the
// beats on either side, so a calm beat never looks more intense than it is.
/** The points edge to edge, with the curve's slope at each (flat at peaks and valleys). */
function shape(points, width) {
    const pts = [{ x: 0, y: points[0].y }, ...points, { x: width, y: points[points.length - 1].y }];
    const slope = pts.map((p, i) => {
        const prev = pts[i - 1];
        const next = pts[i + 1];
        if (!prev || !next)
            return 0;
        const a = (p.y - prev.y) / Math.max(1e-6, p.x - prev.x);
        const b = (next.y - p.y) / Math.max(1e-6, next.x - p.x);
        return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
    });
    return { pts, slope };
}
/** A smooth SVG path from the left edge to the right edge through every point. */
export function wavePath(points, width) {
    if (!points.length)
        return '';
    const { pts, slope } = shape(points, width);
    const r = (n) => Math.round(n * 10) / 10;
    let d = `M${r(pts[0].x)},${r(pts[0].y)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i];
        const q = pts[i + 1];
        const dx = (q.x - p.x) / 3;
        d += ` C${r(p.x + dx)},${r(p.y + slope[i] * dx)} ${r(q.x - dx)},${r(q.y - slope[i + 1] * dx)} ${r(q.x)},${r(q.y)}`;
    }
    return d;
}
/** The height of the wave at x, exactly on the drawn line. */
export function waveY(points, width, x) {
    if (!points.length)
        return 0;
    const { pts, slope } = shape(points, width);
    const i = Math.max(0, Math.min(pts.length - 2, pts.findIndex((p, k) => k > 0 && x <= p.x) - 1));
    const p = pts[i];
    const q = pts[i + 1];
    const h = Math.max(1e-6, q.x - p.x);
    // The curve's handles sit a third of the way along, so x moves evenly with t.
    const t = Math.max(0, Math.min(1, (x - p.x) / h));
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p.y + (t3 - 2 * t2 + t) * h * slope[i] + (-2 * t3 + 3 * t2) * q.y + (t3 - t2) * h * slope[i + 1];
}
/** The same wave closed down to the baseline, for filling the area under it. */
export const waveArea = (points, width, base) => (points.length ? `${wavePath(points, width)} L${width},${base} L0,${base} Z` : '');
