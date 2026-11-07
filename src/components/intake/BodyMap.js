import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { bodyAreas } from '../../content/intake';
import { toggle } from './Bits';
// A simple front and back outline. Tap a spot on the figure or its name.
const spots = {
    head: { x: 50, y: 14, r: 9 },
    neck: { x: 50, y: 27, r: 5 },
    shoulders: { x: 50, y: 34, r: 8 },
    chest: { x: 50, y: 44, r: 9 },
    arms: { x: 26, y: 52, r: 7 },
    'wrists-hands': { x: 20, y: 76, r: 7 },
    belly: { x: 50, y: 60, r: 8 },
    hips: { x: 50, y: 72, r: 8 },
    genitals: { x: 50, y: 81, r: 6 },
    knees: { x: 42, y: 112, r: 6 },
    'ankles-feet': { x: 42, y: 140, r: 7 },
    'upper-back': { x: 150, y: 42, r: 10 },
    'lower-back': { x: 150, y: 62, r: 9 },
    butt: { x: 150, y: 78, r: 9 },
    thighs: { x: 142, y: 96, r: 8 },
    calves: { x: 142, y: 124, r: 7 }
};
function Figure({ cx }) {
    return (_jsxs("g", { fill: "var(--surface-sunk)", stroke: "var(--line)", strokeWidth: "1.5", children: [_jsx("circle", { cx: cx, cy: 14, r: 10 }), _jsx("rect", { x: cx - 14, y: 28, width: 28, height: 52, rx: 10 }), _jsx("rect", { x: cx - 26, y: 32, width: 9, height: 46, rx: 4 }), _jsx("rect", { x: cx + 17, y: 32, width: 9, height: 46, rx: 4 }), _jsx("rect", { x: cx - 13, y: 80, width: 11, height: 68, rx: 5 }), _jsx("rect", { x: cx + 2, y: 80, width: 11, height: 68, rx: 5 })] }));
}
export function BodyMap({ value, onChange, legend, hint }) {
    return (_jsxs("fieldset", { className: "field", children: [_jsx("legend", { className: "field-label", children: legend }), hint && _jsx("span", { className: "field-hint", children: hint }), _jsxs("svg", { viewBox: "0 0 200 156", style: { width: '100%', maxWidth: 320, alignSelf: 'center' }, role: "img", "aria-label": "Body outline, front and back", children: [_jsx(Figure, { cx: 50 }), _jsx(Figure, { cx: 150 }), _jsx("text", { x: 50, y: 155, textAnchor: "middle", fontSize: "7", fill: "var(--text-muted)", children: "Front" }), _jsx("text", { x: 150, y: 155, textAnchor: "middle", fontSize: "7", fill: "var(--text-muted)", children: "Back" }), bodyAreas.map((a) => {
                        const s = spots[a.id];
                        const on = value.includes(a.id);
                        return (_jsx("circle", { cx: s.x, cy: s.y, r: s.r, fill: on ? 'var(--accent)' : 'transparent', fillOpacity: on ? 0.55 : 0, stroke: on ? 'var(--accent-strong)' : 'transparent', style: { cursor: 'pointer' }, onClick: () => onChange(toggle(value, a.id)), children: _jsx("title", { children: a.label }) }, a.id));
                    })] }), _jsx("div", { className: "chips", children: bodyAreas.map((a) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": value.includes(a.id), onClick: () => onChange(toggle(value, a.id)), children: a.label }, a.id))) })] }));
}
