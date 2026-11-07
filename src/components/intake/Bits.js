import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
// Small building blocks shared by the intake screens.
export function toggle(list, item, max) {
    if (list.includes(item))
        return list.filter((x) => x !== item);
    if (max && list.length >= max)
        return [...list.slice(1), item];
    return [...list, item];
}
/** Pick any number (or up to max) from a set of chips. */
export function Chips({ legend, hint, options, value, onChange, max }) {
    return (_jsxs("fieldset", { className: "field", children: [_jsx("legend", { className: "field-label", children: legend }), hint && _jsx("span", { className: "field-hint", children: hint }), _jsx("div", { className: "chips", children: options.map((o) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": value.includes(o.id), title: o.title, onClick: () => onChange(toggle(value, o.id, max)), children: o.label }, o.id))) })] }));
}
/** Pick exactly one, shown as stacked choices with an optional description. */
export function OneOf({ legend, hint, options, value, onChange }) {
    const id = useId();
    return (_jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", id: id, children: legend }), hint && _jsx("span", { className: "field-hint", children: hint }), _jsx("div", { className: "stack", role: "radiogroup", "aria-labelledby": id, children: options.map((o) => (_jsx("button", { type: "button", className: "choice", role: "radio", "aria-checked": value === o.id, onClick: () => onChange(o.id), children: _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: o.label }), o.desc && (_jsx("span", { className: "choice-desc", style: { display: 'block' }, children: o.desc }))] }) }, o.id))) })] }));
}
/** A compact one-of control for short labels. */
export function Segments({ label, options, value, onChange }) {
    const id = useId();
    return (_jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", id: id, style: { fontSize: 16 }, children: label }), _jsx("div", { className: "segmented", role: "radiogroup", "aria-labelledby": id, style: { alignSelf: 'flex-start' }, children: options.map((o) => (_jsx("button", { type: "button", role: "radio", "aria-checked": value === o.id, onClick: () => onChange(o.id), children: o.label }, o.id))) })] }));
}
export function TextArea({ label, hint, value, onChange, rows = 3, max = 2000 }) {
    return (_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: label }), hint && _jsx("span", { className: "field-hint", children: hint }), _jsx("textarea", { className: "input", rows: rows, maxLength: max, value: value, onChange: (e) => onChange(e.target.value) })] }));
}
export function TextInput({ label, hint, value, onChange, type = 'text', max = 80, autoComplete }) {
    return (_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: label }), hint && _jsx("span", { className: "field-hint", children: hint }), _jsx("input", { className: "input", type: type, maxLength: max, autoComplete: autoComplete, value: value, onChange: (e) => onChange(e.target.value) })] }));
}
export function Section({ title, children }) {
    return (_jsxs("section", { className: "card stack", style: { gap: 18 }, children: [_jsx("h2", { className: "eyebrow", children: title }), children] }));
}
