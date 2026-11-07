import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { VibeCurve, VibeView } from '../../components/scene/VibeView';
import { phaseLabels } from '../../content/phases';
import { activities } from '../../data/activities';
import { AccountError, cardFor, listConnections } from '../../lib/account';
import { listSharedVibes, planStatus, requestPlan } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';
// The bottom's side of M5. BS1: SceneVibes shared with you, in the Scenes tab.
// BS2: one SceneVibe, with Request full plan. BS3: the plan, if the Top sent it.
function useShared() {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const [vibes, setVibes] = useState(null);
    const [people, setPeople] = useState([]);
    useEffect(() => {
        if (!keys)
            return;
        Promise.all([listSharedVibes(keys), listConnections(keys, cardFor(settings.identity)).catch(() => [])])
            .then(([v, p]) => {
            setVibes(v);
            setPeople(p);
        })
            .catch(() => setVibes([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys]);
    const from = (ownerId) => people.find((c) => c.otherId === ownerId);
    return { vibes, setVibes, from };
}
/** Upcoming SceneVibes from your Tops, for the Scenes tab. */
export function SharedVibes() {
    const { vibes, from } = useShared();
    if (!vibes?.length)
        return null;
    return (_jsxs("section", { className: "stack", style: { gap: 10 }, "aria-label": "SceneVibes shared with you", children: [_jsx("div", { className: "eyebrow", children: "Shared with you" }), vibes.map((v) => {
                const c = from(v.ownerId);
                const name = c ? displayName(c) : 'Your Top';
                return (_jsxs(Link, { to: `/vibes/${v.id}`, className: "card stack", style: { gap: 8, textDecoration: 'none', color: 'inherit' }, children: [_jsxs("div", { className: "person", style: { gap: 10 }, children: [_jsx(Avatar, { ownerId: v.ownerId, photo: c?.them?.photo, name: name, size: 36 }), _jsx("span", { className: "person-name", style: { flex: 1 }, children: v.vibe.title }), _jsx("span", { className: "note", children: v.vibe.date ? new Date(`${v.vibe.date}T12:00`).toLocaleDateString() : 'No date yet' })] }), _jsx(VibeCurve, { vibe: v.vibe, height: 60 }), _jsxs("span", { className: "note", children: ["From ", name, v.check && !v.answered ? '. Pre-scene check waiting for you.' : v.live && !v.live.endedAt ? '. The scene has started.' : ''] })] }, v.id));
            })] }));
}
export function VibePage() {
    const { id = '' } = useParams();
    const { vibes, setVibes, from } = useShared();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const shared = vibes?.find((v) => v.id === id);
    if (vibes === null) {
        return (_jsx("main", { className: "screen", children: _jsx("p", { className: "note", children: "Loading..." }) }));
    }
    if (!shared) {
        return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Scenes" }), _jsx("p", { className: "card", children: "That SceneVibe isn't available. Your Top may have stopped sharing it." })] }));
    }
    const c = from(shared.ownerId);
    const name = c ? displayName(c) : 'Your Top';
    const status = planStatus(shared);
    async function ask() {
        setBusy(true);
        setError('');
        try {
            await requestPlan(shared.id);
            setVibes((all) => (all ?? []).map((v) => (v.id === shared.id ? { ...v, requestedAt: new Date().toISOString() } : v)));
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't send. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Scenes" }), _jsxs("div", { className: "person", style: { gap: 12, justifyContent: 'flex-start' }, children: [_jsx(Avatar, { ownerId: shared.ownerId, photo: c?.them?.photo, name: name, size: 44 }), _jsxs("p", { className: "lede", style: { margin: 0 }, children: [name, " designed this for you."] })] }), shared.check && (_jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": "Pre-scene check", children: [_jsx("div", { className: "eyebrow", children: "Before the scene" }), shared.live && !shared.live.endedAt ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "setting-desc", style: { margin: 0 }, children: "The scene has started." }), _jsx(Link, { to: `/vibes/${shared.id}/live`, className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Open the live view" })] })) : shared.answered ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "setting-desc", style: { margin: 0 }, children: "You've sent your part of the pre-scene check." }), _jsx(Link, { to: `/vibes/${shared.id}/live`, className: "btn btn-outline", style: { alignSelf: 'flex-start' }, children: "Open the live view" })] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: [name, " sent the pre-scene check", shared.check.maybes.length ? `, with ${shared.check.maybes.length === 1 ? 'one maybe' : `${shared.check.maybes.length} maybes`} to say yes or no to` : '', "."] }), _jsx(Link, { to: `/vibes/${shared.id}/check`, className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Answer the check" })] }))] })), _jsx(VibeView, { vibe: shared.vibe }), _jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": "The full plan", children: [_jsx("div", { className: "eyebrow", children: "The full plan" }), status === 'sent' ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: [name, " shared the full plan with you."] }), _jsx(Link, { to: `/vibes/${shared.id}/plan`, className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Read the plan" })] })) : status === 'requested' ? (_jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: ["Requested. ", name, " will decide."] })) : status === 'declined' ? (_jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: [name, " would like to keep it a surprise this time. Your limits and everything you shared still guide every part of it."] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: ["The SceneVibe shows the shape, not every detail. You can ask to see the whole plan, and ", name, " decides."] }), _jsx("button", { type: "button", className: "btn btn-outline", style: { alignSelf: 'flex-start' }, disabled: busy, onClick: () => void ask(), children: "Request full plan" })] })), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] })] }));
}
/** BS3: the plan as the Top sent it, read only. */
export function PlanPage() {
    const { id = '' } = useParams();
    const { vibes, from } = useShared();
    const shared = vibes?.find((v) => v.id === id);
    if (vibes === null) {
        return (_jsx("main", { className: "screen", children: _jsx("p", { className: "note", children: "Loading..." }) }));
    }
    const plan = shared?.plan;
    if (!shared || !plan) {
        return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: `/vibes/${id}`, className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 SceneVibe" }), _jsx("p", { className: "card", children: "This plan isn't available." })] }));
    }
    const c = from(shared.ownerId);
    const name = c ? displayName(c) : 'Your Top';
    const label = (activityId) => activities.find((a) => a.id === activityId)?.label;
    return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: `/vibes/${shared.id}`, className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 SceneVibe" }), _jsx("h1", { children: plan.title }), _jsxs("p", { className: "lede", children: ["The plan ", name, " shared with you. It can still change as you both check in on the day."] }), plan.phases.map((p) => (_jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": phaseLabels[p.type], children: [_jsxs("div", { className: "eyebrow", children: [phaseLabels[p.type], " \u00B7 ", p.beats.reduce((n, b) => n + b.minutes, 0), " min"] }), p.beats.map((b) => (_jsxs("div", { className: "stack", style: { gap: 4 }, children: [_jsx("strong", { children: b.title || 'Untitled' }), _jsxs("span", { className: "note", children: [b.minutes, " min, intensity ", b.intensity] }), _jsx("ul", { style: { margin: 0, paddingLeft: 18 }, children: b.steps.map((s) => (_jsxs("li", { children: [label(s.activityId) && !s.do.toLowerCase().startsWith(label(s.activityId).toLowerCase()) ? _jsxs("strong", { children: [label(s.activityId), ": "] }) : null, s.do, s.say && _jsxs("span", { className: "note", style: { display: 'block' }, children: ["\"", s.say, "\""] })] }, s.id))) })] }, b.id)))] }, p.id)))] }));
}
