import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { tabLabel } from '../content/copy';
import { useSettings } from '../state/settings';
// Stand-in for tabs that later milestones fill in.
const upcoming = {
    connections: 'Invite partners, send guest links, and keep everything you know about each person in one place.',
    profile: 'Your desires, limits and aftercare, all owned by you, with control over who sees what.'
};
export function Placeholder({ tab }) {
    const { settings } = useSettings();
    return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: tabLabel(tab, settings.discreet) }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "eyebrow", children: "On the way" }), _jsx("p", { children: upcoming[tab] })] })] }));
}
