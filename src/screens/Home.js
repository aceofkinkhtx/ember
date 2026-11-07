import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { EmberMark } from '../components/EmberMark';
import { DonationPrompt } from '../components/DonationPrompt';
import { RoleToggle } from '../components/RoleToggle';
import { NextScene } from '../components/scene/NextScene';
import { useSettings } from '../state/settings';
// H1 (Top) and BH1 (bottom). Real content arrives with later milestones;
// for now each card says what will live there.
export function Home() {
    const { settings } = useSettings();
    const scene = settings.discreet ? 'plan' : 'scene';
    const isTop = settings.activeRole === 'top';
    return (_jsxs("main", { className: "screen", children: [_jsx(DonationPrompt, {}), _jsxs("div", { className: "topbar", children: [_jsx(EmberMark, {}), _jsx(RoleToggle, {})] }), isTop ? (_jsxs(_Fragment, { children: [_jsx("h1", { children: "What needs you today" }), !settings.top.offerings.setAt && (_jsxs("div", { className: "card", children: [_jsx("div", { className: "eyebrow", children: "Your setup" }), _jsx("div", { className: "card-title", children: "Tell Ember what you offer" }), _jsx("p", { className: "setting-desc", children: "Scene designs are built only from what you offer and what your partner says yes to." }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: [_jsx(Link, { to: "/me/offerings", className: "btn btn-primary", children: "Your offerings" }), _jsx(Link, { to: "/me/top-settings", className: "btn btn-outline", children: "Your settings" })] })] })), _jsxs("div", { className: "card", children: [_jsx("div", { className: "eyebrow", children: "Check-ins" }), _jsx("div", { className: "card-title", children: "Nothing due" }), _jsxs("p", { className: "setting-desc", children: ["Check-ins after a ", scene, " show up here first, about 18 hours later."] })] }), _jsx(NextScene, { role: "top", word: scene, empty: `Give a design a date and it shows up here, with a countdown.` }), _jsx(TipCard, {}), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsxs(Link, { to: "/scenes", className: "btn btn-primary", style: { flex: 1 }, children: ["New ", scene] }), _jsx(Link, { to: "/connections", className: "btn btn-outline", style: { flex: 1 }, children: "Invite" })] })] })) : (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Your space" }), _jsx("p", { className: "lede", children: "Share what you want, own your limits, and see what's coming." }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "eyebrow", children: "Your profile" }), _jsx("div", { className: "card-title", children: "Tell your partner what you want" }), _jsx("p", { className: "setting-desc", children: "Choose quick words, a map, or the detailed form. Every path ends in a profile you control." }), _jsx(Link, { to: "/profile", className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Start" })] }), _jsx(NextScene, { role: "bottom", word: scene, empty: `When your Top shares a ${scene}, its SceneVibe appears here.` }), _jsx(TipCard, {})] }))] }));
}
function TipCard() {
    const { settings } = useSettings();
    if (!settings.notifications.dailyTips)
        return null;
    return (_jsxs("div", { className: "card card-teal", children: [_jsx("div", { className: "eyebrow", children: "Today's note" }), _jsx("p", { children: "Your daily tip will appear here. The full library arrives in a later update." })] }));
}
