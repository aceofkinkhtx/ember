import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listScenes } from '../../lib/scenes';
import { listSharedVibes } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { MiniCurve } from './SceneCurve';
import { VibeCurve } from './VibeView';
// Home's next-scene card (H1 and BH1), with a countdown. A Top sees their next
// dated design; a bottom sees the next SceneVibe a Top shared with them.
const today = () => new Date().toISOString().slice(0, 10);
/** "Today", "Tomorrow" or "In 5 days". */
export function countdown(date, now = new Date()) {
    const days = Math.round((new Date(`${date}T12:00`).getTime() - new Date(`${now.toISOString().slice(0, 10)}T12:00`).getTime()) / 86_400_000);
    return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
}
export function NextScene({ role, word, empty }) {
    const { keys, status } = useAccount();
    const [next, setNext] = useState(undefined);
    useEffect(() => {
        if (!keys)
            return;
        const soon = (list, date) => list.filter((x) => date(x) >= today()).sort((a, b) => date(a).localeCompare(date(b)))[0];
        if (role === 'top')
            listScenes(keys)
                .then((all) => setNext({ scene: soon(all.filter((s) => s.date && s.role === 'top'), (s) => s.date) }))
                .catch(() => setNext(null));
        else
            listSharedVibes(keys)
                .then((all) => setNext({ vibe: soon(all.filter((v) => v.vibe.date), (v) => v.vibe.date) }))
                .catch(() => setNext(null));
    }, [keys, role]);
    const item = next?.scene ?? next?.vibe;
    if (status !== 'signed-in' || !item) {
        return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "eyebrow", children: ["Next ", word] }), _jsx("div", { className: "card-title", children: "Nothing planned yet" }), _jsx("p", { className: "setting-desc", children: empty })] }));
    }
    const date = next?.scene ? next.scene.date : next.vibe.vibe.date;
    const title = next?.scene ? next.scene.title : next.vibe.vibe.title;
    const v = next?.vibe;
    // A waiting pre-scene check, or a scene under way, goes straight there.
    const waiting = Boolean(v?.check && !v.answered);
    const running = Boolean(v?.live && !v.live.endedAt);
    const to = next?.scene ? `/scenes/${next.scene.id}` : waiting ? `/vibes/${v.id}/check` : running ? `/vibes/${v.id}/live` : `/vibes/${v.id}`;
    return (_jsxs(Link, { to: to, className: "card stack", style: { gap: 8, textDecoration: 'none', color: 'inherit' }, children: [_jsxs("div", { className: "person", children: [_jsxs("span", { className: "eyebrow", children: ["Next ", word] }), _jsx("span", { className: "tag tag-gray", children: countdown(date) })] }), _jsx("div", { className: "card-title", style: { margin: 0 }, children: title }), next?.scene ? _jsx(MiniCurve, { scene: next.scene, height: 44 }) : _jsx(VibeCurve, { vibe: next.vibe.vibe, height: 60 }), _jsx("span", { className: "note", children: new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }), waiting && _jsx("span", { className: "box box-info", children: "Your pre-scene check is waiting. Tap to answer." }), running && _jsx("span", { className: "box box-info", children: "The scene has started. Tap for the live view." })] }));
}
