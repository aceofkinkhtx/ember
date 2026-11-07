import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BottomCheckForm } from '../../components/live/BottomCheckForm';
import { VibeCurve } from '../../components/scene/VibeView';
import { bottomLive } from '../../content/live';
import { AccountError, cardFor, listConnections } from '../../lib/account';
import { answerCheck, readLive, sendSignal } from '../../lib/liveSync';
import { clock, elapsedMs, progressShare } from '../../lib/scene/live';
import { listSharedVibes } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';
import { ToolkitSheet } from './LiveScene';
// Live Scene Mode, the bottom's side (M6). Before: their part of the
// pre-scene check, with every maybe in the plan to say yes or no to. During:
// a simple view with the wave moving along, red and yellow buttons that reach
// the Top's phone, and the regulation toolkit. Never the plan itself.
function useShared(id) {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const [vibe, setVibe] = useState(undefined);
    const [top, setTop] = useState(undefined);
    useEffect(() => {
        if (!keys)
            return;
        Promise.all([listSharedVibes(keys), listConnections(keys, cardFor(settings.identity)).catch(() => [])])
            .then(([v, people]) => {
            const found = v.find((x) => x.id === id) ?? null;
            setVibe(found);
            setTop(people.find((c) => c.otherId === found?.ownerId));
        })
            .catch(() => setVibe(null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys, id]);
    return { vibe, name: top ? displayName(top) : 'Your Top' };
}
function Dark({ children }) {
    return (_jsx("div", { "data-theme": "live", className: "live-root", children: _jsx("main", { className: "screen", children: children }) }));
}
/** Their part of the pre-scene check, on their own phone. */
export function BottomCheckPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const { vibe, name } = useShared(id);
    if (vibe === undefined)
        return _jsx(Dark, { children: _jsx("p", { className: "note", children: "Loading..." }) });
    if (!vibe?.check) {
        return (_jsxs(Dark, { children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Scenes" }), _jsx("p", { className: "card", children: "There's no pre-scene check waiting for this scene." })] }));
    }
    return (_jsxs(Dark, { children: [_jsx(Link, { to: `/vibes/${id}`, className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 SceneVibe" }), _jsxs("div", { children: [_jsx("h1", { style: { margin: 0 }, children: "Before you start" }), _jsxs("p", { className: "note", style: { margin: '4px 0 0' }, children: [vibe.vibe.title, ", with ", name, ". Under two minutes. Only ", name, " sees your answers."] })] }), vibe.answered && _jsx("p", { className: "box box-info", children: "You've already sent this. Sending again replaces your answers." }), _jsx(BottomCheckForm, { topName: name, maybes: vibe.check.maybes, onSend: async (c) => {
                    try {
                        await answerCheck(vibe.id, vibe.ownerId, c);
                        navigate(`/vibes/${vibe.id}/live`, { replace: true });
                        return null;
                    }
                    catch (err) {
                        return err instanceof AccountError ? err.message : "That didn't send. Please try again.";
                    }
                } })] }));
}
/** During the scene: the wave, the signals, the toolkit. */
export function BottomLivePage() {
    const { id = '' } = useParams();
    const { keys } = useAccount();
    const { vibe, name } = useShared(id);
    const [live, setLive] = useState(null);
    const [now, setNow] = useState(() => Date.now());
    const [signal, setSignal] = useState({ red: null, yellows: [] });
    const [note, setNote] = useState('');
    const [toolkitOpen, setToolkitOpen] = useState(false);
    useEffect(() => {
        if (!keys)
            return;
        const load = () => void readLive(keys, id).then((l) => l && setLive(l)).catch(() => { });
        load();
        const poll = window.setInterval(load, 4000);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [keys, id]);
    // Keep the screen awake while it's open.
    useEffect(() => {
        if (!('wakeLock' in navigator))
            return;
        let lock = null;
        navigator.wakeLock
            .request('screen')
            .then((l) => (lock = l))
            .catch(() => { });
        return () => void lock?.release().catch(() => { });
    }, []);
    if (vibe === undefined)
        return _jsx(Dark, { children: _jsx("p", { className: "note", children: "Loading..." }) });
    if (!vibe) {
        return (_jsx(Dark, { children: _jsx("p", { className: "card", children: "This scene isn't available." }) }));
    }
    async function send(kind) {
        const at = new Date().toISOString();
        const next = kind === 'red' ? { ...signal, red: at } : { ...signal, yellows: [...signal.yellows, at] };
        setSignal(next);
        try {
            await sendSignal(vibe.id, vibe.ownerId, next);
            setNote(kind === 'red' ? bottomLive.redSent : bottomLive.yellowSent);
        }
        catch {
            setNote(bottomLive.offline);
        }
        if (kind === 'yellow')
            setToolkitOpen(true);
    }
    const share = live ? progressShare(vibe.vibe.minutes, live, now) : 0;
    const status = !live ? `Waiting for ${name} to start.` : live.endedAt ? 'The scene is complete. Take your time with aftercare.' : live.red ? 'Red. Everything has stopped.' : live.pausedAt ? 'Paused.' : `${clock(elapsedMs(live, now))} in.`;
    return (_jsxs(Dark, { children: [_jsx(Link, { to: `/vibes/${id}`, className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 SceneVibe" }), _jsx("h1", { style: { margin: 0 }, children: vibe.vibe.title }), _jsx("p", { className: "lede", "aria-live": "polite", style: { margin: 0 }, children: status }), _jsxs("div", { style: { position: 'relative' }, children: [_jsx(VibeCurve, { vibe: vibe.vibe, height: 120 }), live && (_jsx("div", { "aria-hidden": "true", style: { position: 'absolute', top: 0, bottom: 0, left: `${share * 100}%`, width: 3, background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.8)' } }))] }), _jsx("p", { className: "note", children: bottomLive.intro }), note && (_jsx("p", { className: "box box-info", role: "status", style: { margin: 0 }, children: note })), _jsx("button", { type: "button", className: "live-red", style: { width: '100%', minHeight: 88, fontSize: 28 }, onClick: () => void send('red'), children: bottomLive.red }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { type: "button", className: "btn", style: { flex: 1, minHeight: 64, background: '#B7791F', color: '#fff', fontSize: 20 }, onClick: () => void send('yellow'), children: bottomLive.yellow }), _jsx("button", { type: "button", className: "btn btn-outline", style: { flex: 1, minHeight: 64 }, onClick: () => setToolkitOpen(true), children: "Toolkit" })] }), toolkitOpen && _jsx(ToolkitSheet, { onClose: () => setToolkitOpen(false) })] }));
}
