import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { OfferingsEditor } from '../components/top/OfferingsEditor';
import { TopSettingsEditor } from '../components/top/TopSettingsEditor';
import { useSettings } from '../state/settings';
// Me > Offerings (O4) and Me > Top settings (O5). Changes save as you go.
export function useTopSetup() {
    const { settings, update } = useSettings();
    const now = () => new Date().toISOString();
    return {
        setup: settings.top,
        studio: settings.depth === 'studio',
        changeOfferings: (change) => update((s) => ({ top: { ...s.top, offerings: { ...change(s.top.offerings), setAt: now() } } })),
        changeSettings: (change) => update((s) => ({ top: { ...s.top, settings: { ...change(s.top.settings), setAt: now() } } }))
    };
}
function Back() {
    return (_jsx(Link, { to: "/me", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Me" }));
}
export function OfferingsPage() {
    const { setup, studio, changeOfferings } = useTopSetup();
    return (_jsxs("main", { className: "screen", children: [_jsx(Back, {}), _jsx("h1", { children: "What you offer" }), _jsx("p", { className: "lede", children: "Choose the kinds of play you do and how far you go. Scene designs only use what you offer here." }), _jsx(OfferingsEditor, { setup: setup, studio: studio, onChange: changeOfferings }), !studio && _jsx("p", { className: "note", children: "Edge play appears in Studio mode, which you can turn on under Depth in Me." })] }));
}
export function TopSettingsPage() {
    const { setup, changeSettings } = useTopSetup();
    return (_jsxs("main", { className: "screen", children: [_jsx(Back, {}), _jsx("h1", { children: "Your settings" }), _jsx("p", { className: "lede", children: "Your personal standards. The safety floor applies whatever you choose." }), _jsx(TopSettingsEditor, { value: setup.settings, onChange: changeSettings })] }));
}
