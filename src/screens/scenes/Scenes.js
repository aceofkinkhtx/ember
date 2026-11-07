import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SceneRequests } from '../../components/scene/Requests';
import { SharedVibes } from './VibePage';
import { MiniCurve, sceneFacts } from '../../components/scene/SceneCurve';
import { tabLabel } from '../../content/copy';
import { listScenes } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
const today = () => new Date().toISOString().slice(0, 10);
export function sceneTab(scene) {
    return scene.date && scene.date < today() ? 'past' : 'upcoming';
}
export function Scenes() {
    const { settings } = useSettings();
    const { keys, status } = useAccount();
    const [scenes, setScenes] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('upcoming');
    useEffect(() => {
        if (!keys)
            return;
        listScenes(keys)
            .then(setScenes)
            .catch(() => {
            setScenes([]);
            setError("Ember couldn't load your scenes. Check your connection and try again.");
        });
    }, [keys]);
    const title = tabLabel('scenes', settings.discreet);
    if (status !== 'signed-in') {
        return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: title }), _jsxs("div", { className: "card stack", children: [_jsx("p", { style: { margin: 0 }, children: "Sign in to design scenes. Designs are locked on your phone before they're saved." }), _jsx(Link, { to: "/connections", className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Sign in" })] })] }));
    }
    const shown = (scenes ?? []).filter((s) => (tab === 'library' ? s.inLibrary : sceneTab(s) === tab));
    const ordered = tab === 'upcoming' ? [...shown].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) : shown;
    return (_jsxs("main", { className: "screen", children: [_jsxs("div", { className: "person", children: [_jsx("h1", { style: { margin: 0 }, children: title }), _jsx(Link, { to: "/scenes/new", className: "btn btn-primary", children: "New scene" })] }), _jsx(SceneRequests, {}), _jsx(SharedVibes, {}), _jsx("div", { className: "segmented", role: "tablist", "aria-label": "Which scenes", style: { alignSelf: 'flex-start' }, children: ['upcoming', 'past', 'library'].map((t) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === t, onClick: () => setTab(t), children: t === 'upcoming' ? 'Upcoming' : t === 'past' ? 'Past' : 'Library' }, t))) }), scenes === null ? (_jsx("p", { className: "note", children: "Loading..." })) : ordered.length === 0 ? (_jsx("div", { className: "card stack", children: _jsx("p", { style: { margin: 0 }, children: tab === 'library'
                        ? 'Nothing in your library yet. Turn on "Keep in my library" in any scene to save it here.'
                        : tab === 'past'
                            ? 'No past scenes yet.'
                            : "No scenes planned. Start one from here or from a connection's page." }) })) : (_jsx("ul", { className: "person-list", children: ordered.map((s) => (_jsx("li", { children: _jsxs(Link, { to: `/scenes/${s.id}`, className: "card stack", style: { gap: 6, textDecoration: 'none', color: 'inherit' }, children: [_jsxs("div", { className: "person", children: [_jsx("span", { className: "person-name", children: s.title }), _jsx("span", { className: "note", children: s.date ? new Date(`${s.date}T12:00`).toLocaleDateString() : 'No date' })] }), _jsx(MiniCurve, { scene: s, height: 44 }), s.request && _jsxs("span", { className: "tag tag-gray", style: { alignSelf: 'flex-start' }, children: ["Sent to ", s.partnerName] }), _jsxs("span", { className: "note", children: [s.partnerName ? `With ${s.partnerName}. ` : '', sceneFacts(s)] })] }) }, s.id))) })), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] }));
}
