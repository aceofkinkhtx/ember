import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Line icons drawn from the prototype's tab bar. Decorative: labels carry meaning.
const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
};
export function TabIcon({ tab }) {
    switch (tab) {
        case 'home':
            return (_jsx("svg", { ...common, children: _jsx("path", { d: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" }) }));
        case 'connections':
            return (_jsxs("svg", { ...common, children: [_jsx("circle", { cx: "9", cy: "8", r: "3.5" }), _jsx("circle", { cx: "17", cy: "9", r: "2.5" }), _jsx("path", { d: "M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 20c0-2.5 1.5-4.5 4-4.5" })] }));
        case 'scenes':
            return (_jsx("svg", { ...common, children: _jsx("path", { d: "M3 17c3 0 4-10 7-10s3 8 6 8 3-6 5-6" }) }));
        case 'toys':
            return (_jsxs("svg", { ...common, children: [_jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "3" }), _jsx("path", { d: "M4 14l5-4 4 3 3-2 4 3" })] }));
        case 'profile':
            return (_jsx("svg", { ...common, children: _jsx("path", { d: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" }) }));
        case 'me':
            return (_jsxs("svg", { ...common, children: [_jsx("circle", { cx: "12", cy: "8", r: "4" }), _jsx("path", { d: "M4 21c0-4 3.6-7 8-7s8 3 8 7" })] }));
    }
}
export function RoleIcon({ kind }) {
    if (kind === 'top')
        return (_jsx("svg", { ...common, children: _jsx("path", { d: "M12 3l3 6 6 .9-4.5 4.3 1 6.3L12 17.5 6.5 20.5l1-6.3L3 9.9 9 9z" }) }));
    if (kind === 'bottom')
        return (_jsx("svg", { ...common, children: _jsx("path", { d: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" }) }));
    return (_jsx("svg", { ...common, children: _jsx("path", { d: "M7 7h11l-3-3M17 17H6l3 3" }) }));
}
export function DepthIcon({ kind }) {
    return kind === 'simple' ? (_jsx("svg", { ...common, children: _jsx("circle", { cx: "12", cy: "12", r: "7" }) })) : (_jsxs("svg", { ...common, children: [_jsx("path", { d: "M4 7h10M18 7h2M4 17h4M12 17h8" }), _jsx("circle", { cx: "16", cy: "7", r: "2" }), _jsx("circle", { cx: "10", cy: "17", r: "2" })] }));
}
