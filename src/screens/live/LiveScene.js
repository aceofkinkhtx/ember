import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BottomCheckForm } from '../../components/live/BottomCheckForm';
import { Chips } from '../../components/intake/Bits';
import { circulationCheck, firstAid, redSteps, toolkit } from '../../content/live';
import { phaseColors, phaseLabels, secondPeakColor } from '../../content/phases';
import { aloudList, beatElapsedMs, callRed, careInfo, checkCirculation, clock, currentBeat, elapsedMs, goToBeat, logMoment, maybesIn, pause, readinessIngredients, removeActivities, restraint, resume, safetyKit, spaceSet, startLive } from '../../lib/scene/live';
import { beatsInOrder } from '../../lib/scene/model';
import { activityOf } from '../../lib/scene/rules';
import { clearLocal, keepLocally, readFromBottom, readLocal, sendCheck, sendLive } from '../../lib/liveSync';
import { listScenes, saveScene } from '../../lib/scenes';
import { shareVibe } from '../../lib/vibes';
import { AccountError } from '../../lib/account';
import { useAccount } from '../../state/account';
import { useSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
// Live Scene Mode, the Top's side (M6). L1: the pre-scene check, which locks
// the consent snapshot. L2: the guide, one beat at a time, with timers. L3:
// red. L4: the regulation toolkit. L5: the quick log. Pause stops every timer.
// Once started, the scene runs from this phone, so it keeps working offline.
function useTick(ms, on = true) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!on)
            return;
        const t = window.setInterval(() => setNow(Date.now()), ms);
        return () => window.clearInterval(t);
    }, [ms, on]);
    return now;
}
/** Keeps the screen awake while the scene runs, where the phone allows it. */
function useWakeLock(on) {
    useEffect(() => {
        if (!on || !('wakeLock' in navigator))
            return;
        let lock = null;
        const take = () => {
            navigator.wakeLock
                .request('screen')
                .then((l) => (lock = l))
                .catch(() => { });
        };
        take();
        const again = () => document.visibilityState === 'visible' && take();
        document.addEventListener('visibilitychange', again);
        return () => {
            document.removeEventListener('visibilitychange', again);
            void lock?.release().catch(() => { });
        };
    }, [on]);
}
export function LiveScene() {
    const { id = '' } = useParams();
    const { keys } = useAccount();
    const [scene, setScene] = useState(undefined);
    const current = useRef(null);
    const saveTimer = useRef(undefined);
    const { data } = useSceneData(scene?.connectionId ?? null, scene?.partnerId ?? null, scene?.role ?? 'top');
    const { settings } = useSettings();
    useEffect(() => {
        if (!keys)
            return;
        const local = readLocal(id);
        listScenes(keys)
            .then((all) => {
            const remote = all.find((s) => s.id === id) ?? null;
            // A scene running on this phone wins: it may hold changes made offline.
            const pick = local?.live && !local.live.endedAt ? local : remote;
            current.current = pick;
            setScene(pick);
        })
            .catch(() => {
            current.current = local;
            setScene(local);
        });
    }, [keys, id]);
    /** Every change: kept on this phone at once, saved and sent when online. */
    const update = useCallback((next) => {
        current.current = next;
        setScene(next);
        if (next.live && !next.live.endedAt)
            keepLocally(next);
        if (next.live && next.share && next.partnerId)
            void sendLive(next.share.id, next.partnerId, next.live, next);
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            if (keys && current.current)
                void saveScene(keys, current.current).catch(() => { });
        }, 1500);
    }, [keys]);
    const fallback = { intake: null, top: settings.top, studio: settings.depth === 'studio', optedOutGear: [], gear: [] };
    const ctx = data?.ctx ?? fallback;
    if (scene === undefined) {
        return (_jsx(Dark, { children: _jsx("p", { className: "note", children: "Loading..." }) }));
    }
    if (!scene || scene.role !== 'top') {
        return (_jsxs(Dark, { children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Scenes" }), _jsx("p", { className: "card", children: "That scene isn't available to run on this phone." })] }));
    }
    if (!scene.live)
        return _jsx(PreCheck, { scene: scene, ctx: ctx, loading: data === undefined, onStart: update, onChange: update });
    if (scene.live.endedAt)
        return _jsx(Finished, { scene: scene });
    return _jsx(Guide, { scene: scene, ctx: ctx, onChange: update, gearLabel: (gid) => (gid ? (data?.gear.find((g) => g.id === gid)?.name ?? null) : null) });
}
function Dark({ children, style }) {
    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        const before = meta?.getAttribute('content');
        meta?.setAttribute('content', '#141012');
        return () => {
            if (before)
                meta?.setAttribute('content', before);
        };
    }, []);
    return (_jsx("div", { "data-theme": "live", className: "live-root", children: _jsx("main", { className: "screen", style: style, children: children }) }));
}
// L1: the pre-scene check --------------------------------------------------------
function PreCheck({ scene, ctx, loading, onStart, onChange }) {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const name = scene.partnerName || 'them';
    const maybes = maybesIn(scene, ctx);
    const [top, setTop] = useState({ capacity: 0, kit: [], space: [] });
    const [aloud, setAloud] = useState([]);
    const [answer, setAnswer] = useState(null);
    const [handover, setHandover] = useState(false);
    const [talked, setTalked] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const asked = Boolean(scene.checkAskedAt && scene.share);
    const now = useTick(5000, asked && !answer);
    // The bottom's answers arrive from their phone.
    useEffect(() => {
        if (!keys || !asked || answer || !scene.share)
            return;
        void readFromBottom(keys, scene.share.id).then((r) => r?.answer && setAnswer(r.answer));
    }, [keys, asked, answer, scene.share, now]);
    async function ask() {
        if (!keys || !scene.partnerId)
            return;
        setBusy(true);
        setError('');
        try {
            const shared = scene.share ? scene : await shareVibe(keys, scene, settings.top.settings.phaseColors);
            await sendCheck(shared.share.id, scene.partnerId, { maybes: maybes.map((m) => ({ activityId: m.activityId, label: m.label })), askedAt: new Date().toISOString() });
            onChange({ ...shared, checkAskedAt: new Date().toISOString() });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't send. Check your connection, or answer together on this phone.");
        }
        finally {
            setBusy(false);
        }
    }
    const items = aloudList(scene, ctx.intake);
    const answerOf = (m) => answer?.maybes[m.activityId] ?? null;
    const toTalk = maybes.filter((m) => answerOf(m) === 'talk' && !talked[m.activityId]);
    const removed = maybes.filter((m) => answerOf(m) === 'no' || (answerOf(m) === 'talk' && talked[m.activityId] === 'remove')).map((m) => m.activityId);
    const missing = [
        !answer && `${name}'s part`,
        toTalk.length && `talking through ${toTalk.length === 1 ? 'one maybe' : `${toTalk.length} maybes`}`,
        !top.capacity && 'your capacity today',
        top.kit.length < safetyKit.length && 'the safety kit',
        aloud.length < items.length && 'the list to say aloud'
    ].filter(Boolean);
    function start() {
        if (!answer)
            return;
        const now = new Date().toISOString();
        const snapshot = {
            lockedAt: now,
            intakeVersion: scene.intakeVersion,
            top,
            bottom: answer,
            aloud: items.map((i) => i.text),
            maybes: maybes.map((m) => ({ ...m, answer: answerOf(m) })),
            removed,
            care: careInfo(ctx.intake)
        };
        const planned = removeActivities(scene, removed);
        onStart({ ...planned, live: startLive(planned, ctx, snapshot, now) });
    }
    if (handover) {
        return (_jsxs(Dark, { children: [_jsxs("h1", { style: { margin: 0 }, children: [name, "'s part"] }), _jsxs("p", { className: "lede", children: ["Hand the phone to ", name, ". Their answers stay with this scene."] }), _jsx(BottomCheckForm, { topName: "your Top", maybes: maybes, onTopPhone: true, onSend: async (c) => {
                        setAnswer(c);
                        setHandover(false);
                        return null;
                    } }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => setHandover(false), children: "Cancel" })] }));
    }
    return (_jsxs(Dark, { children: [_jsx(Link, { to: `/scenes/${scene.id}`, className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Design" }), _jsxs("div", { children: [_jsx("h1", { style: { margin: 0 }, children: "Before you start" }), _jsxs("p", { className: "note", style: { margin: '4px 0 0' }, children: [scene.title, ". Under two minutes, mostly taps. Starting locks today's consent snapshot."] })] }), loading && _jsxs("p", { className: "note", children: ["Loading ", name, "'s answers..."] }), _jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": `${name}'s part`, children: [_jsxs("div", { className: "eyebrow", children: [name, "'s part"] }), answer ? (_jsx(BottomSummary, { answer: answer, maybes: maybes, talked: talked, onTalked: (id, v) => setTalked({ ...talked, [id]: v }) })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: ["How they are today, their readiness, and a yes or no to ", maybes.length === 1 ? 'the one maybe' : maybes.length ? `the ${maybes.length} maybes` : 'anything new', " in the plan."] }), maybes.length > 0 && (_jsxs("p", { className: "box box-warn", style: { margin: 0 }, children: ["Maybes in the plan: ", maybes.map((m) => m.label).join(', '), ". ", name, " sees these by name and must say yes or no before you start."] })), scene.partnerId &&
                                (asked ? (_jsxs("p", { className: "note", style: { margin: 0 }, children: ["Sent to ", name, "'s phone. Waiting for their answers..."] })) : (_jsxs("button", { type: "button", className: "btn btn-primary", disabled: busy, onClick: () => void ask(), children: ["Send the check to ", name, "'s phone"] }))), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => setHandover(true), children: "Answer together on this phone" })] })), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] }), _jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Your part", children: [_jsx("div", { className: "eyebrow", children: "Your part" }), _jsx(Capacity, { value: top.capacity, onChange: (capacity) => setTop({ ...top, capacity }) }), top.capacity > 0 && top.capacity <= 2 && (_jsx("p", { className: "box box-warn", style: { margin: 0 }, children: "Low capacity today. A shorter or gentler scene is a good call, and so is another day." })), _jsx(Chips, { legend: "Safety kit ready", hint: "All four, within reach.", options: safetyKit.map((k) => ({ id: k, label: k })), value: top.kit, onChange: (kit) => setTop({ ...top, kit }) }), _jsx(Chips, { legend: "Space set", hint: "Whatever this scene needs.", options: spaceSet.map((k) => ({ id: k, label: k })), value: top.space, onChange: (space) => setTop({ ...top, space }) })] }), _jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": "Say aloud together", children: [_jsx("div", { className: "eyebrow", children: "Say aloud together" }), items.map((i) => (_jsxs("label", { className: "choice", style: { alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: aloud.includes(i.id), onChange: (e) => setAloud(e.target.checked ? [...aloud, i.id] : aloud.filter((x) => x !== i.id)), style: { width: 22, height: 22, flex: '0 0 auto' } }), _jsx("span", { children: i.text })] }, i.id)))] }), missing.length > 0 && _jsxs("p", { className: "note", children: ["Still to do: ", missing.join(', '), "."] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: missing.length > 0, onClick: start, style: { minHeight: 56, fontSize: 18 }, children: "Start the scene" })] }));
}
function Capacity({ value, onChange }) {
    return (_jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", style: { fontSize: 16 }, children: "Your energy and focus today" }), _jsx("div", { className: "segmented", role: "radiogroup", "aria-label": "Your energy and focus today, 1 to 5", style: { alignSelf: 'flex-start' }, children: [1, 2, 3, 4, 5].map((n) => (_jsx("button", { type: "button", role: "radio", "aria-checked": value === n, onClick: () => onChange(n), children: n }, n))) }), _jsx("span", { className: "note", children: "1 is running on empty, 5 is fully here" })] }));
}
function BottomSummary({ answer, maybes, talked, onTalked }) {
    const low = (n) => n > 0 && n <= 2;
    const lowOnes = [answer.feeling, answer.body, answer.emotion, answer.excitement].some(low);
    const notHere = readinessIngredients.filter((r) => !answer.readiness.includes(r));
    return (_jsxs("div", { className: "stack", style: { gap: 8 }, children: [_jsxs("p", { style: { margin: 0 }, children: ["Feeling ", answer.feeling, " of 5, body ", answer.body, ", emotionally ", answer.emotion, ", excitement ", answer.excitement, ".", answer.onTopPhone ? ' Answered on this phone.' : ''] }), lowOnes && _jsx("p", { className: "box box-warn", style: { margin: 0 }, children: "Something is low today. Talk about it before you start, and scale down or wait if it helps." }), !answer.finalNegotiation && _jsx("p", { className: "box box-warn", style: { margin: 0 }, children: "They haven't had a final negotiation. Have it now, before you start." }), answer.bodyNote && _jsxs("p", { style: { margin: 0 }, children: ["Body today: ", answer.bodyNote] }), answer.emotionNote && _jsxs("p", { style: { margin: 0 }, children: ["On their mind: ", answer.emotionNote] }), answer.anythingNew && _jsxs("p", { className: "box box-warn", style: { margin: 0 }, children: ["New since you last talked: ", answer.newNote || 'yes, ask them'] }), notHere.length > 0 && _jsxs("p", { style: { margin: 0 }, children: ["Not here today: ", notHere.join(', ').toLowerCase(), ". Worth a word."] }), maybes.map((m) => {
                const a = answer.maybes[m.activityId];
                return (_jsxs("div", { className: "person", style: { gap: 8, flexWrap: 'wrap' }, children: [_jsxs("span", { style: { flex: 1 }, children: [_jsxs("strong", { children: [m.label, ":"] }), " ", a === 'yes' ? 'yes' : a === 'no' ? 'no, it comes out of the plan' : a === 'talk' ? "let's talk" : 'no answer'] }), a === 'talk' && (_jsxs("span", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { type: "button", className: "chip", "aria-pressed": talked[m.activityId] === 'keep', onClick: () => onTalked(m.activityId, 'keep'), children: "Talked: keep it" }), _jsx("button", { type: "button", className: "chip", "aria-pressed": talked[m.activityId] === 'remove', onClick: () => onTalked(m.activityId, 'remove'), children: "Take it out" })] }))] }, m.activityId));
            })] }));
}
function Guide({ scene, ctx, onChange, gearLabel }) {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const live = scene.live;
    const now = useTick(1000);
    const [overlay, setOverlay] = useState(null);
    const [tab, setTab] = useState('do');
    const [banner, setBanner] = useState('');
    const seen = useRef(null);
    const autoToolkitFor = useRef(null);
    useWakeLock(true);
    const set = useCallback((next) => onChange({ ...scene, live: next }), [onChange, scene]);
    const all = beatsInOrder(scene);
    const here = currentBeat(scene, live);
    const colors = phaseColors(settings.top.settings.phaseColors);
    const colorOf = (i) => {
        const p = all[i].phase;
        if (p.type !== 'peak')
            return colors[p.type];
        const nth = scene.phases.filter((x) => x.type === 'peak').indexOf(p);
        return nth > 0 ? (settings.top.settings.phaseColors.peak ? colors.peak : secondPeakColor) : colors.peak;
    };
    const name = scene.partnerName || 'They';
    const care = live.snapshot.care;
    // Signals from the bottom's phone.
    const poll = useTick(4000, Boolean(scene.share));
    useEffect(() => {
        if (!keys || !scene.share)
            return;
        void readFromBottom(keys, scene.share.id).then((r) => {
            if (!r)
                return;
            const sig = r.signal ?? { red: null, yellows: [] };
            const yellow = sig.yellows.at(-1) ?? null;
            if (!seen.current) {
                seen.current = { red: sig.red, yellow };
                return;
            }
            if (sig.red && sig.red !== seen.current.red) {
                set(callRed(scene.live, new Date().toISOString(), true));
                setBanner(`${name} pressed red on their phone.`);
            }
            else if (yellow && yellow !== seen.current.yellow) {
                set(logMoment(scene.live, 'their-yellow', new Date().toISOString()));
                setBanner(`${name} pressed yellow on their phone. Slow down and check in.`);
                setOverlay('toolkit');
            }
            seen.current = { red: sig.red, yellow };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [poll, keys]);
    // The toolkit opens by itself in a recovery beat.
    useEffect(() => {
        if (here.phase.type === 'recovery' && autoToolkitFor.current !== live.beat) {
            autoToolkitFor.current = live.beat;
            setOverlay('toolkit');
        }
    }, [here.phase.type, live.beat]);
    useEffect(() => {
        if (!banner)
            return;
        const t = window.setTimeout(() => setBanner(''), 8000);
        return () => window.clearTimeout(t);
    }, [banner]);
    const beatMs = beatElapsedMs(live, now);
    const over = beatMs > here.beat.minutes * 60000;
    const bound = restraint(live, now);
    const last = live.beat >= all.length - 1;
    const iso = () => new Date().toISOString();
    const go = (i) => set(goToBeat(scene, ctx, live, i, Date.now()));
    const steps = here.beat.steps;
    const label = (activityId) => activityOf(ctx, activityId)?.label ?? null;
    if (live.red) {
        return (_jsx(RedScreen, { scene: scene, byThem: live.log.at(-1)?.kind === 'their-red', onAftercare: () => {
                const first = all.findIndex((b) => b.phase.type === 'aftercare');
                const resumed = resume(live, iso());
                set(first >= 0 ? goToBeat(scene, ctx, resumed, first, Date.now()) : resumed);
            }, onResume: () => set(resume(live, iso())) }));
    }
    return (_jsxs("div", { "data-theme": "live", className: "live-root", children: [_jsxs("header", { className: "live-head", style: { borderBottom: `4px solid ${colorOf(live.beat)}` }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: scene.title }), _jsxs("div", { className: "note", style: { margin: 0 }, children: [phaseLabels[here.phase.type], " \u00B7 ", clock(elapsedMs(live, now))] })] }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => set(pause(live, iso())), children: "Pause" })] }), _jsxs("main", { className: "screen live-body", children: [banner && (_jsx("p", { className: "box box-warn", role: "alert", style: { margin: 0 }, children: banner })), care.signals && (_jsxs("div", { className: "chips", "aria-label": "Signals", children: [_jsx("span", { className: "signal", style: { background: '#2E6B2E' }, children: care.signals.green }), _jsx("span", { className: "signal", style: { background: '#B7791F' }, children: care.signals.yellow }), _jsx("span", { className: "signal", style: { background: '#B3261E' }, children: care.signals.red }), care.signals.handSign && _jsx("span", { className: "signal", style: { background: '#3a3034' }, children: care.signals.handSign })] })), _jsx(CareStrip, { care: care }), bound && (_jsxs("div", { className: `box ${bound.checkDue ? 'box-warn' : 'box-info'}`, role: bound.checkDue ? 'alert' : undefined, style: { margin: 0 }, children: [_jsxs("strong", { children: ["Restrained ", clock(bound.ms), "."] }), " ", bound.checkDue ? circulationCheck : 'Never leave them alone.', bound.checkDue && (_jsx("button", { type: "button", className: "btn btn-secondary", style: { display: 'block', marginTop: 8 }, onClick: () => set(checkCirculation(live, Date.now())), children: "Checked" }))] })), _jsxs("article", { className: "card stack live-beat", style: { gap: 10, borderTop: `6px solid ${colorOf(live.beat)}` }, "aria-label": here.beat.title || 'Beat', children: [_jsxs("div", { className: "person", children: [_jsxs("span", { className: "eyebrow", style: { color: 'var(--text-muted)' }, children: [phaseLabels[here.phase.type], " \u00B7 beat ", live.beat + 1, " of ", all.length] }), _jsxs("span", { style: { fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: over ? '#ffb347' : undefined }, "aria-label": "Time in this beat", children: [clock(beatMs), " / ", here.beat.minutes, ":00"] })] }), _jsx("h2", { style: { margin: 0 }, children: here.beat.title || 'Untitled beat' }), _jsxs("span", { className: "note", children: ["Intensity ", here.beat.intensity, " of 10"] }), here.beat.flags.map((f, k) => (_jsx("p", { className: `box box-${f.kind}`, style: { margin: 0 }, children: f.text }, k))), _jsx("div", { className: "segmented", role: "tablist", "aria-label": "Beat details", children: ['do', 'say', 'watch', 'notes'].map((t) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === t, "aria-checked": tab === t, onClick: () => setTab(t), children: t.toUpperCase() }, t))) }), _jsxs("ol", { className: "stack", style: { gap: 10, margin: 0, paddingLeft: 20 }, children: [steps.map((s) => {
                                        const text = tab === 'do' ? s.do : tab === 'say' ? s.say : tab === 'watch' ? s.watch : s.notes;
                                        // The activity's name, unless the step already starts with it.
                                        const name = label(s.activityId);
                                        const what = [name && !s.do.toLowerCase().startsWith(name.toLowerCase()) ? name : null, gearLabel(s.gearId)].filter(Boolean).join(', ');
                                        return (_jsxs("li", { style: { fontSize: 18, lineHeight: 1.45 }, children: [what && tab === 'do' && _jsxs("strong", { style: { display: 'block' }, children: [what, s.surprise ? ' (surprise)' : ''] }), text || _jsx("span", { className: "note", children: "Nothing here." })] }, s.id));
                                    }), !steps.length && _jsx("li", { className: "note", children: "No steps in this beat." })] })] }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { type: "button", className: "btn btn-outline", style: { flex: 1, minHeight: 56 }, disabled: live.beat === 0, onClick: () => go(live.beat - 1), children: "\u2039 Back" }), last ? (_jsx("button", { type: "button", className: "btn btn-primary", style: { flex: 2, minHeight: 56 }, onClick: () => set({ ...live, endedAt: iso() }), children: "Finish the scene" })) : (_jsx("button", { type: "button", className: "btn btn-primary", style: { flex: 2, minHeight: 56 }, onClick: () => go(live.beat + 1), children: "Next beat \u203A" }))] }), _jsx("nav", { className: "live-dots", "aria-label": "Phases", children: scene.phases.map((p) => {
                            const first = all.findIndex((b) => b.phase.id === p.id);
                            if (first < 0)
                                return null;
                            const active = here.phase.id === p.id;
                            return (_jsx("button", { type: "button", "aria-label": `Go to ${phaseLabels[p.type]}`, "aria-current": active || undefined, onClick: () => go(first), style: { background: colorOf(first), outline: active ? '3px solid var(--text)' : 'none' } }, p.id));
                        }) })] }), _jsxs("div", { className: "live-actions", children: [_jsx("button", { type: "button", className: "live-red", onClick: () => set(callRed(live, iso())), children: "Red" }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => setOverlay('toolkit'), children: "Toolkit" }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => setOverlay('log'), children: "Log" })] }), overlay === 'toolkit' && _jsx(ToolkitSheet, { onClose: () => setOverlay(null) }), overlay === 'log' && (_jsx(LogSheet, { live: live, onLog: (kind, text) => {
                    set(logMoment(live, kind, iso(), text));
                    setOverlay(kind === 'yellow' ? 'toolkit' : null);
                }, onClose: () => setOverlay(null) })), live.pausedAt && (_jsxs("div", { className: "live-paused", role: "dialog", "aria-modal": "true", "aria-label": "Paused", children: [_jsx("p", { style: { fontSize: 22, fontWeight: 700, margin: 0 }, children: "Paused" }), _jsx("p", { className: "note", children: "Every timer has stopped." }), _jsx("button", { type: "button", className: "btn btn-primary", style: { minHeight: 56, minWidth: 200 }, onClick: () => set(resume(live, iso())), children: "Resume" })] }))] }));
}
/** The limit strip and body notes, from the snapshot, so it works offline. */
function CareStrip({ care }) {
    return (_jsxs("div", { className: "stack", style: { gap: 6 }, children: [care.limits.hard.length > 0 && (_jsxs("p", { className: "strip", style: { background: '#B3261E', color: '#fff' }, children: [_jsx("strong", { children: "No:" }), " ", care.limits.hard.join(', ')] })), care.limits.soft.length > 0 && (_jsxs("p", { className: "strip", style: { background: '#E8A317', color: '#1d1406' }, children: [_jsx("strong", { children: "Maybe:" }), " ", care.limits.soft.join(', ')] })), care.body && (_jsxs("p", { className: "strip", style: { background: '#1a3a6b', color: '#fff' }, children: [_jsx("strong", { children: "Body:" }), " ", care.body] }))] }));
}
// L3: red ------------------------------------------------------------------------
function RedScreen({ scene, byThem, onAftercare, onResume }) {
    const [confirming, setConfirming] = useState(false);
    const care = scene.live.snapshot.care;
    const name = scene.partnerName || 'them';
    const aftercareBeats = scene.phases.filter((p) => p.type === 'aftercare').flatMap((p) => p.beats.map((b) => b.title)).filter(Boolean);
    const e = care.emergency;
    useWakeLock(true);
    return (_jsx("div", { className: "live-redscreen", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "red-title", children: _jsxs("main", { className: "screen", style: { background: 'transparent' }, children: [_jsx("h1", { id: "red-title", style: { fontSize: 44, margin: 0, color: '#fff' }, children: "Stop. Check in." }), byThem && _jsxs("p", { style: { margin: 0, fontWeight: 700 }, children: [name, " pressed red on their phone."] }), _jsx("ol", { className: "stack", style: { gap: 8, paddingLeft: 22, margin: 0, fontSize: 18 }, children: redSteps.map((s) => (_jsx("li", { children: s }, s))) }), _jsxs("section", { className: "red-card", children: [_jsx("h2", { children: "Their aftercare" }), _jsx("p", { children: [...care.aftercare, ...aftercareBeats].join(', ') || 'Ask what they need: water, a blanket, closeness or space.' }), care.overwhelm.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "If they're overwhelmed" }), _jsx("p", { children: care.overwhelm.join('. ') })] })), care.body && (_jsxs(_Fragment, { children: [_jsx("h2", { children: "Body notes" }), _jsx("p", { children: care.body })] }))] }), _jsxs("section", { className: "red-card", children: [_jsx("h2", { children: "Emergency" }), e?.kind === 'person' && (_jsxs("a", { className: "btn btn-block red-call", href: `tel:${e.phone.replace(/[^\d+]/g, '')}`, children: ["Call ", e.name] })), _jsx("a", { className: "btn btn-block red-call", href: "tel:911", children: "Call 911" }), _jsx("ul", { style: { margin: '8px 0 0', paddingLeft: 18 }, children: firstAid.map((f) => (_jsx("li", { children: f }, f))) })] }), _jsx("button", { type: "button", className: "btn btn-block red-primary", onClick: onAftercare, children: "Go to aftercare" }), confirming ? (_jsxs("div", { className: "red-card stack", style: { gap: 8 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 700 }, children: "Have you both checked in, and do you both want to go on?" }), _jsx("button", { type: "button", className: "btn btn-block red-ghost", onClick: onResume, children: "Yes, resume the scene" }), _jsx("button", { type: "button", className: "btn btn-block red-ghost", onClick: () => setConfirming(false), children: "Not yet" })] })) : (_jsx("button", { type: "button", className: "btn btn-block red-ghost", onClick: () => setConfirming(true), children: "Resume the scene..." }))] }) }));
}
// L4 and L5: toolkit and quick log ----------------------------------------------------
export function ToolkitSheet({ onClose }) {
    const [open, setOpen] = useState(null);
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Regulation toolkit", onClick: onClose, children: _jsxs("div", { className: "sheet", style: { maxHeight: '88vh', overflowY: 'auto' }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "person", children: [_jsx("h2", { style: { margin: 0 }, children: "Steady the moment" }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: onClose, children: "Close" })] }), toolkit.map((g) => (_jsxs("section", { className: "stack", style: { gap: 8 }, "aria-label": g.label, children: [_jsx("div", { className: "eyebrow", children: g.label }), g.prompts.map((p) => {
                            const key = `${g.id}:${p.title}`;
                            return (_jsx("button", { type: "button", className: "choice", "aria-expanded": open === key, onClick: () => setOpen(open === key ? null : key), style: { minHeight: 56 }, children: _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: p.title }), open === key && (_jsx("span", { className: "choice-desc", style: { display: 'block', fontSize: 17 }, children: p.text }))] }) }, key));
                        })] }, g.id)))] }) }));
}
function LogSheet({ live, onLog, onClose }) {
    const [note, setNote] = useState('');
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-label": "Quick log", onClick: onClose, children: _jsxs("div", { className: "sheet", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "person", children: [_jsx("h2", { style: { margin: 0 }, children: "Log a moment" }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: onClose, children: "Close" })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { type: "button", className: "btn", style: { flex: 1, minHeight: 56, background: '#B7791F', color: '#fff' }, onClick: () => onLog('yellow'), children: "Yellow" }), _jsx("button", { type: "button", className: "btn btn-secondary", style: { flex: 1, minHeight: 56 }, onClick: () => onLog('highlight'), children: "Highlight" })] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { className: "input", "aria-label": "A note", placeholder: "A note", maxLength: 200, value: note, onChange: (e) => setNote(e.target.value), style: { flex: 1 } }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: !note.trim(), onClick: () => onLog('note', note.trim()), children: "Save" })] }), _jsx(LogList, { live: live })] }) }));
}
const logWords = {
    yellow: 'Yellow',
    highlight: 'Highlight',
    note: 'Note',
    red: 'Red',
    circulation: 'Circulation checked',
    'their-yellow': 'Yellow from their phone',
    'their-red': 'Red from their phone'
};
function LogList({ live }) {
    if (!live.log.length)
        return null;
    return (_jsx("ul", { className: "stack", style: { gap: 4, margin: 0, paddingLeft: 18 }, children: [...live.log].reverse().map((l, i) => (_jsxs("li", { children: [new Date(l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }), ": ", logWords[l.kind], l.text ? `: ${l.text}` : ''] }, i))) }));
}
// After the last beat -----------------------------------------------------------
function Finished({ scene }) {
    const navigate = useNavigate();
    const live = scene.live;
    useEffect(() => clearLocal(), []);
    return (_jsxs(Dark, { children: [_jsx("h1", { style: { margin: 0 }, children: "Scene complete" }), _jsxs("p", { className: "lede", children: [clock(elapsedMs(live, Date.now())), " on the clock. Stay close: aftercare doesn't end with the app."] }), _jsxs("section", { className: "card stack", style: { gap: 8 }, "aria-label": "Log", children: [_jsx("div", { className: "eyebrow", children: "What you logged" }), live.log.length ? _jsx(LogList, { live: live }) : _jsx("p", { className: "note", children: "Nothing logged." })] }), _jsxs("section", { className: "card stack", style: { gap: 6 }, "aria-label": "Consent snapshot", children: [_jsx("div", { className: "eyebrow", children: "Consent snapshot" }), _jsxs("p", { style: { margin: 0 }, children: ["Locked ", new Date(live.snapshot.lockedAt).toLocaleString(), "."] }), live.snapshot.maybes.length > 0 && _jsxs("p", { style: { margin: 0 }, children: ["Maybes: ", live.snapshot.maybes.map((m) => `${m.label} (${m.answer === 'yes' ? 'yes' : m.answer === 'no' ? 'no' : 'talked'})`).join(', '), "."] })] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => navigate(`/scenes/${scene.id}`), children: "Back to the design" })] }));
}
