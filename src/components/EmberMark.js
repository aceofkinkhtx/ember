import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** The ember glyph: the app icon's flame without its dark tile (public/ember-mark.svg). */
export function EmberGlyph({ size = 24 }) {
    return _jsx("img", { src: "/ember-mark.svg", alt: "", "aria-hidden": "true", className: "mark-glyph", height: size, width: Math.round((size * 420) / 540) });
}
export function EmberMark({ large = false }) {
    return (_jsxs("span", { className: large ? 'mark mark-large' : 'mark', children: [_jsx(EmberGlyph, { size: large ? 48 : 30 }), "ember"] }));
}
