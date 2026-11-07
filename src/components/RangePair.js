import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// A slider with two handles for a low and a high end, with a tick for every
// step. Each handle is its own native slider, so keyboards and screen readers
// work as usual.
export function RangePair({ label, min, max, low, high, ends, onChange }) {
    const at = (n) => (n - min) / (max - min);
    const fill = { '--from': at(low), '--to': at(high) };
    const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (_jsxs("div", { className: "range-pair-wrap", children: [_jsxs("div", { className: "range-pair", style: fill, children: [_jsx("input", { type: "range", min: min, max: max, step: 1, value: low, "aria-label": `${label}, from`, "aria-valuetext": `From ${low}`, onChange: (e) => onChange(Math.min(Number(e.target.value), high), high) }), _jsx("input", { type: "range", min: min, max: max, step: 1, value: high, "aria-label": `${label}, up to`, "aria-valuetext": `Up to ${high}`, onChange: (e) => onChange(low, Math.max(Number(e.target.value), low)) })] }), _jsx("div", { className: "range-ticks", "aria-hidden": "true", children: ticks.map((t) => (_jsx("span", { "data-on": t >= low && t <= high }, t))) }), _jsxs("div", { className: "note range-ends", "aria-hidden": "true", children: [_jsxs("span", { children: [min, " ", ends[0]] }), _jsxs("span", { children: [ends[1], " ", max] })] })] }));
}
