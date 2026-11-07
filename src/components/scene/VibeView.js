import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
import { waveArea, wavePath, waveY } from './wave';
import { phaseColors, phaseLabels, secondPeakColor } from '../../content/phases';
// SceneVibe (BS2): the shape of a planned scene. The curve is drawn in the
// Top's phase colors; on it, one shape and color per kind of play, and a
// question mark for each surprise.
export const kindLabels = {
    impact: 'Impact',
    sensation: 'Sensation',
    bondage: 'Restraint',
    touch: 'Touch',
    digital: 'Fingers',
    penetration: 'Penetration',
    surprise: 'A surprise'
};
const kindColors = {
    impact: '#B8400C',
    sensation: '#C98A12',
    bondage: '#0B5D61',
    touch: '#B5446E',
    digital: '#5A3E9B',
    penetration: '#8E1B3B',
    surprise: '#1E1418'
};
/** One marker shape, centered on (x, y). */
export function KindShape({ kind, x = 0, y = 0, r = 8 }) {
    const fill = kindColors[kind];
    switch (kind) {
        case 'impact':
            return _jsx("polygon", { points: `${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}`, fill: fill });
        case 'sensation': {
            const p = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const a = (Math.PI / 4) * i - Math.PI / 2;
                const rr = i % 2 ? r * 0.42 : r;
                return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
            });
            return _jsx("polygon", { points: p.join(' '), fill: fill });
        }
        case 'bondage':
            return _jsx("rect", { x: x - r * 0.8, y: y - r * 0.8, width: r * 1.6, height: r * 1.6, rx: r * 0.25, fill: "none", stroke: fill, strokeWidth: r * 0.35 });
        case 'touch':
            return _jsx("circle", { cx: x, cy: y, r: r * 0.85, fill: fill });
        case 'digital':
            return _jsx("polygon", { points: `${x},${y - r} ${x + r * 0.8},${y} ${x},${y + r} ${x - r * 0.8},${y}`, fill: fill });
        case 'penetration': {
            const p = [0, 1, 2, 3, 4, 5].map((i) => {
                const a = (Math.PI / 3) * i;
                return `${x + Math.cos(a) * r * 0.9},${y + Math.sin(a) * r * 0.9}`;
            });
            return _jsx("polygon", { points: p.join(' '), fill: fill });
        }
        case 'surprise':
            return (_jsxs("g", { children: [_jsx("circle", { cx: x, cy: y, r: r, fill: "#E8A33A", stroke: fill, strokeWidth: 1.5, strokeDasharray: "3 2" }), _jsx("text", { x: x, y: y + r * 0.42, textAnchor: "middle", fontSize: r * 1.25, fontWeight: 700, fill: fill, children: "?" })] }));
    }
}
function colorFor(vibe, phase) {
    const colors = phaseColors(vibe.colors);
    if (phase.phase === 'peak' && phase.peakNo > 1)
        return vibe.colors.peak ? colors.peak : secondPeakColor;
    return colors[phase.phase];
}
/** The curve and its markers. Small enough for a card, clear enough on its own. */
export function VibeCurve({ vibe, height = 120, markers = true }) {
    const width = 320;
    const total = Math.max(1, vibe.minutes);
    const x = (m) => (m / total) * width;
    // The calmest beats keep a little height, so every phase color shows.
    const y = (i) => 4 + (height - 8) - ((Math.max(i, 1.6) - 1) / 9) * (height - 8);
    const clip = useId();
    const points = vibe.segments.map((s) => ({ x: x(s.from + s.minutes / 2), y: y(s.intensity) }));
    // Markers sit on the line itself, each on a small light disc so it reads
    // over any phase color. Ones that would touch slide apart along the line.
    const r = height >= 100 ? 6 : 4.5;
    const disc = r + 2.5;
    const gap = ((disc * 2 + 1) / 320) * 100;
    const xs = [...vibe.markers].sort((a, b) => a.at - b.at).map((m) => ({ m, pct: (m.at / total) * 100 }));
    for (let i = 1; i < xs.length; i++)
        xs[i].pct = Math.max(xs[i].pct, xs[i - 1].pct + gap);
    for (let i = xs.length - 1; i >= 0; i--)
        xs[i].pct = Math.min(xs[i].pct, (i === xs.length - 1 ? 100 - gap / 2 : xs[i + 1].pct - gap));
    const pad = markers && xs.length ? Math.ceil(disc) : 0;
    return (_jsxs("div", { role: "img", "aria-label": vibeSummary(vibe), style: { position: 'relative', paddingTop: pad }, children: [_jsxs("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height: height, preserveAspectRatio: "none", "aria-hidden": "true", style: { display: 'block' }, children: [_jsx("defs", { children: _jsx("clipPath", { id: clip, children: _jsx("path", { d: waveArea(points, width, height) }) }) }), _jsx("g", { clipPath: `url(#${clip})`, children: vibe.segments.map((s, i) => (_jsx("rect", { x: x(s.from), y: 0, width: Math.max(0, x(s.minutes)), height: height, fill: colorFor(vibe, s), opacity: 0.85 }, i))) }), _jsx("path", { d: wavePath(points, width), fill: "none", stroke: "var(--text)", strokeWidth: 2, strokeLinecap: "round", vectorEffect: "non-scaling-stroke" })] }), markers &&
                xs.map(({ m, pct }, i) => (_jsxs("svg", { "aria-hidden": "true", width: disc * 2, height: disc * 2, viewBox: `${-disc} ${-disc} ${disc * 2} ${disc * 2}`, style: { position: 'absolute', left: `calc(${pct}% - ${disc}px)`, top: pad + waveY(points, width, (pct / 100) * width) - disc }, children: [_jsx("circle", { r: disc, fill: "var(--surface)", stroke: "var(--text)", strokeWidth: 0.75 }), _jsx(KindShape, { kind: m.kind, r: r })] }, i)))] }));
}
/** A spoken version of the picture, for screen readers. */
export function vibeSummary(vibe) {
    const peaks = new Set(vibe.segments.filter((s) => s.phase === 'peak').map((s) => s.peakNo)).size;
    const kinds = [...new Set(vibe.markers.filter((m) => m.kind !== 'surprise').map((m) => kindLabels[m.kind].toLowerCase()))];
    return [
        `A ${vibe.minutes} minute scene with ${peaks} ${peaks === 1 ? 'peak' : 'peaks'}`,
        kinds.length ? `including ${kinds.join(', ')}` : '',
        vibe.surprises ? `and ${vibe.surprises === 1 ? 'a surprise' : `${vibe.surprises} surprises`}` : ''
    ]
        .filter(Boolean)
        .join(', ');
}
const fmtTime = (minutes) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
function Row({ label, children }) {
    return (_jsxs("p", { style: { margin: 0 }, children: [_jsxs("strong", { children: [label, ":"] }), " ", children] }));
}
/** The whole SceneVibe, exactly as the bottom sees it. */
export function VibeView({ vibe }) {
    const kinds = [...new Set(vibe.markers.map((m) => m.kind))];
    const phases = [...new Set(vibe.segments.map((s) => s.phase))];
    const when = vibe.date ? new Date(`${vibe.date}T${vibe.startTime || '12:00'}`) : null;
    return (_jsxs("div", { className: "stack", style: { gap: 14 }, children: [_jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "SceneVibe", children: [_jsx("div", { className: "eyebrow", children: "SceneVibe" }), _jsx("h2", { style: { margin: 0 }, children: vibe.title }), _jsx(VibeCurve, { vibe: vibe, height: 150 }), _jsx("div", { className: "chips", "aria-label": "What the shapes mean", style: { gap: 10 }, children: kinds.map((k) => (_jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }, children: [_jsx("svg", { width: 18, height: 18, viewBox: "-9 -9 18 18", "aria-hidden": "true", children: _jsx(KindShape, { kind: k, r: 8 }) }), kindLabels[k]] }, k))) }), _jsx("div", { className: "chips", "aria-label": "Phases", style: { gap: 10 }, children: phases.map((p) => (_jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }, children: [_jsx("span", { "aria-hidden": "true", style: { width: 12, height: 12, borderRadius: 3, background: phaseColors(vibe.colors)[p] } }), phaseLabels[p]] }, p))) }), vibe.surprises > 0 && (_jsxs("p", { className: "box box-info", children: [vibe.surprises === 1 ? 'Your Top has a surprise planned.' : `Your Top has ${vibe.surprises} surprises planned.`, " You'll know it when it happens."] }))] }), _jsxs("section", { className: "card stack", style: { gap: 6 }, "aria-label": "Details", children: [_jsxs(Row, { label: "When", children: [when ? when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Not set yet', vibe.startTime && when ? `, ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''] }), _jsxs(Row, { label: "How long", children: [fmtTime(vibe.minutes - vibe.aftercareMinutes), ", then ", fmtTime(vibe.aftercareMinutes), " of aftercare"] }), vibe.location && _jsx(Row, { label: "Where", children: vibe.location }), _jsx(Row, { label: "Setting", children: vibe.isPublic ? 'Public or at a party' : 'Private' }), vibe.intense && _jsx("p", { className: "note", style: { margin: 0 }, children: "This one is planned as intense, with extra aftercare." })] }), vibe.prepare && (_jsxs("section", { className: "card stack", style: { gap: 6 }, "aria-label": "To bring or prepare", children: [_jsx("div", { className: "eyebrow", children: "To bring or prepare" }), _jsx("p", { style: { margin: 0, whiteSpace: 'pre-wrap' }, children: vibe.prepare })] })), _jsxs("section", { className: "card stack", style: { gap: 6 }, "aria-label": "Aftercare", children: [_jsx("div", { className: "eyebrow", children: "Aftercare" }), _jsxs("p", { style: { margin: 0 }, children: [fmtTime(vibe.aftercareMinutes), vibe.aftercare.length ? `: ${vibe.aftercare.join(', then ').toLowerCase()}` : '', ", and more if you need it."] })] })] }));
}
