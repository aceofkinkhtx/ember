import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ActivityList, ActivityTag, useAddActivity } from '../../components/scene/ActivityPicker';
import { MiniCurve, PhaseStrip, sceneFacts } from '../../components/scene/SceneCurve';
import { Segments, TextArea, TextInput } from '../../components/intake/Bits';
import { SettingSwitch } from '../../components/Switch';
import { shapes } from '../../content/sceneText';
import { phaseLabels } from '../../content/phases';
import { categories, markOptions } from '../../data/activities';
import { moved } from '../../components/scene/useReorder';
import { AccountError, cardFor, listConnections } from '../../lib/account';
import { designOptions, suggestedPicks } from '../../lib/scene/designer';
import { activityOf, blocks, validate, warnings } from '../../lib/scene/rules';
import { clearSceneDraft, loadSceneDraft, saveScene, saveSceneDraft } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { useSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
import { displayName } from '../Connections';
const MARK_ORDER = ['none', 'day', 'week', 'open'];
function blankRequest() {
    return {
        title: '',
        connectionId: null,
        partnerId: null,
        partnerName: '',
        role: 'top',
        date: '',
        startTime: '',
        minutes: 90,
        location: '',
        isPublic: false,
        intense: false,
        intakeVersion: null,
        marks: 'none',
        useSpecificGear: false,
        gearIds: [],
        picks: [],
        overrides: [],
        notes: ''
    };
}
export function SceneNew() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { settings } = useSettings();
    const { keys, status } = useAccount();
    const [people, setPeople] = useState(null);
    const [step, setStep] = useState('basics');
    const [req, setReq] = useState(() => {
        const draft = loadSceneDraft()?.request;
        const wanted = params.get('connection');
        return draft && (!wanted || draft.connectionId === wanted) ? draft : { ...blankRequest(), connectionId: wanted };
    });
    const [picksReady, setPicksReady] = useState(req.picks.length > 0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const { data, showTheirGear } = useSceneData(req.connectionId, req.partnerId, req.role);
    useEffect(() => saveSceneDraft({ request: req }), [req]);
    useEffect(() => {
        document.querySelector('main.screen')?.scrollTo?.(0, 0);
    }, [step]);
    useEffect(() => {
        if (!keys)
            return;
        listConnections(keys, cardFor(settings.identity))
            .then((all) => setPeople(all.filter((c) => c.status === 'active')))
            .catch(() => setPeople([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys]);
    // Fill in the partner once the list arrives.
    useEffect(() => {
        if (!people || !req.connectionId || req.partnerId)
            return;
        const c = people.find((p) => p.id === req.connectionId);
        if (c)
            setReq((r) => ({ ...r, partnerId: c.otherId, partnerName: displayName(c), role: c.myRole === 'bottom' ? 'bottom' : r.role, title: r.title || `Scene with ${displayName(c)}` }));
    }, [people, req.connectionId, req.partnerId]);
    // Once their intake loads: the marks they agreed to, the version, and suggested picks.
    useEffect(() => {
        if (!data)
            return;
        setReq((r) => {
            const agreed = data.ctx.intakeOf === 'none' ? 'open' : (data.ctx.intake?.detailed?.impact.marks ?? 'none');
            const marks = MARK_ORDER.indexOf(r.marks) <= MARK_ORDER.indexOf(agreed) && r.intakeVersion === data.intakeVersion ? r.marks : agreed;
            return { ...r, intakeVersion: data.intakeVersion, marks };
        });
        if (!picksReady) {
            // Designing for a Top, picks start in the middle: their range applies when they accept.
            setReq((r) => ({ ...r, picks: suggestedPicks(data.ctx).map((p) => (r.role === 'bottom' ? { ...p, intensity: Math.min(p.intensity, 6) } : p)) }));
            setPicksReady(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);
    if (status !== 'signed-in') {
        return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: "New scene" }), _jsx("p", { className: "card", children: "Sign in to design scenes. Designs are locked on your phone before they're saved." })] }));
    }
    const set = (patch) => setReq((r) => ({ ...r, ...patch }));
    async function choose(index) {
        if (!keys || !data)
            return;
        setBusy(true);
        setError('');
        try {
            const options = designOptions(req, data.ctx);
            const saved = await saveScene(keys, req.solo ? { ...options[index], inLibrary: true } : options[index]);
            clearSceneDraft();
            navigate(`/scenes/${saved.id}`, { replace: true });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't save this scene. Please try again.");
            setBusy(false);
        }
    }
    return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/scenes", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Scenes" }), _jsx("div", { className: "progress-bar", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": 3, "aria-valuenow": ['basics', 'picks', 'options'].indexOf(step) + 1, "aria-label": `Step ${['basics', 'picks', 'options'].indexOf(step) + 1} of 3`, children: _jsx("span", { style: { width: `${((['basics', 'picks', 'options'].indexOf(step) + 1) / 3) * 100}%` } }) }), step === 'basics' && (_jsx(Basics, { req: req, set: set, people: people, data: data, showTheirGear: showTheirGear, onNext: () => setStep('picks'), onPerson: (c) => {
                    setPicksReady(false);
                    set({ solo: false, connectionId: c.id, partnerId: c.otherId, partnerName: displayName(c), role: c.myRole === 'bottom' ? 'bottom' : 'top', title: `Scene with ${displayName(c)}`, picks: [], overrides: [], gearIds: [] });
                }, onSolo: (role) => {
                    setPicksReady(false);
                    set({ solo: true, connectionId: null, partnerId: null, partnerName: '', role, title: req.title.startsWith('Scene with') || !req.title ? 'New scene' : req.title, picks: [], overrides: [], gearIds: [] });
                }, onRole: (role) => {
                    setPicksReady(false);
                    set({ role, picks: [], overrides: [] });
                } })), step === 'picks' && data && _jsx(Picks, { req: req, set: set, ctx: data.ctx, gear: data.gear.filter((g) => !data.ctx.optedOutGear.includes(g.id)), onBack: () => setStep('basics'), onNext: () => setStep('options') }), step === 'options' && data && _jsx(Options, { req: req, data: data, busy: busy, onBack: () => setStep('picks'), onChoose: choose }), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] }));
}
function Basics({ req, set, people, data, showTheirGear, onPerson, onSolo, onRole, onNext }) {
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [gearNote, setGearNote] = useState('');
    if (people === null)
        return _jsx("p", { className: "note", children: "Loading..." });
    const agreed = data?.ctx.intakeOf === 'none' ? 'open' : (data?.ctx.intake?.detailed?.impact.marks ?? 'none');
    const marks = markOptions.filter((m) => MARK_ORDER.indexOf(m.id) <= MARK_ORDER.indexOf(agreed));
    const pct = req.intense ? settings.top.settings.intensePercent : settings.top.settings.aftercarePercent;
    const gear = (data?.gear ?? []).filter((g) => !data?.ctx.optedOutGear.includes(g.id));
    const hours = `${Math.floor(req.minutes / 60) ? `${Math.floor(req.minutes / 60)} h ` : ''}${req.minutes % 60 ? `${req.minutes % 60} min` : ''}`.trim();
    return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Scene basics" }), _jsxs("section", { className: "card stack", style: { gap: 14 }, children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Who is this scene with?" }), _jsxs("select", { className: "input", value: req.solo ? 'solo' : (req.connectionId ?? ''), onChange: (e) => {
                                    if (e.target.value === 'solo')
                                        return onSolo(settings.roles === 'bottom' ? 'bottom' : settings.roles === 'top' ? 'top' : settings.activeRole);
                                    const c = people.find((p) => p.id === e.target.value);
                                    if (c)
                                        onPerson(c);
                                }, children: [_jsx("option", { value: "", children: "Choose someone" }), _jsx("option", { value: "solo", children: "No one yet (save it to my library)" }), people.map((c) => (_jsx("option", { value: c.id, children: displayName(c) }, c.id)))] })] }), req.solo && settings.roles === 'both' && (_jsx(Segments, { label: "In this scene you are:", options: [
                            { id: 'top', label: 'Top' },
                            { id: 'bottom', label: 'bottom' }
                        ], value: req.role, onChange: onSolo })), req.solo && data && (_jsx("p", { className: "note", style: { margin: 0 }, children: req.role === 'bottom'
                            ? `Designing from your own intake${data.ctx.intake ? ` (version ${data.intakeVersion})` : ''}. It goes to your library; send it to a Top later with "Use with someone else".`
                            : 'Designing from your offerings, with no one in mind yet. It goes to your library; use it with someone later and Ember checks it against their limits.' })), !people.length && !req.solo && _jsx("p", { className: "note", style: { margin: 0 }, children: "No connections yet, so this design will be for your library." }), req.connectionId && people.find((c) => c.id === req.connectionId)?.myRole === 'switch' && (_jsx(Segments, { label: `You and ${req.partnerName} are S/switches. In this scene you are:`, options: [
                            { id: 'top', label: 'Top' },
                            { id: 'bottom', label: 'bottom' }
                        ], value: req.role, onChange: onRole })), req.connectionId && data === undefined && _jsx("p", { className: "note", children: "Loading the intake..." }), req.connectionId && data && (_jsx("p", { className: "note", style: { margin: 0 }, children: req.role === 'bottom'
                            ? data.ctx.intake
                                ? `Designing from your own intake (version ${data.intakeVersion}). ${req.partnerName} gets it as a request to accept and edit, with their own offerings and settings applied.`
                                : 'Save your intake first (Profile), so the design knows what you said yes to.'
                            : data.ctx.intake
                                ? `Designing from ${req.partnerName}'s intake (version ${data.intakeVersion}). Ember only suggests what they said yes to.`
                                : `${req.partnerName} hasn't shared an intake with you yet. You can still design, but every activity will be flagged "Discussed together?". Ask them to share from their profile.` })), _jsx(TextInput, { label: "Name for this scene", value: req.title, max: 60, onChange: (title) => set({ title }) })] }), _jsxs("section", { className: "card stack", style: { gap: 14 }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: [_jsxs("label", { className: "field", style: { flex: 1, minWidth: 140 }, children: [_jsx("span", { className: "field-label", children: "Date" }), _jsx("input", { className: "input", type: "date", value: req.date, onChange: (e) => set({ date: e.target.value }) })] }), _jsxs("label", { className: "field", style: { flex: 1, minWidth: 120 }, children: [_jsx("span", { className: "field-label", children: "Start time" }), _jsx("input", { className: "input", type: "time", value: req.startTime, onChange: (e) => set({ startTime: e.target.value }) })] })] }), _jsxs("label", { className: "field", children: [_jsxs("span", { className: "field-label", children: ["Play time: ", _jsx("strong", { children: hours })] }), _jsxs("span", { className: "field-hint", children: ["Aftercare comes after this: ", pct, "% of it", req.intense ? ', never under 30 minutes' : '', "."] }), _jsx("input", { type: "range", min: 20, max: 480, step: 5, value: req.minutes, "aria-valuetext": hours, onChange: (e) => set({ minutes: Number(e.target.value) }) })] }), _jsx(TextInput, { label: "Where (optional)", value: req.location, max: 80, onChange: (location) => set({ location }) }), _jsx(Segments, { label: "Setting", options: [
                            { id: 'private', label: 'Private' },
                            { id: 'public', label: 'Public or party' }
                        ], value: req.isPublic ? 'public' : 'private', onChange: (v) => set({ isPublic: v === 'public' }) }), _jsx(SettingSwitch, { label: "Intense scene", description: `Aftercare becomes ${settings.top.settings.intensePercent}% of play time, and never under 30 minutes.`, checked: req.intense, onChange: (intense) => set({ intense }) }), data && (_jsxs("div", { className: "stack", style: { gap: 6 }, children: [_jsx(Segments, { label: "Marks for this scene", options: marks, value: req.marks, onChange: (m) => set({ marks: m }) }), _jsx("span", { className: "note", children: req.role === 'bottom' ? 'Up to what your intake says.' : `You can choose less than ${req.partnerName || 'they'} agreed to, never more.` })] }))] }), _jsxs("section", { className: "card stack", style: { gap: 12 }, children: [_jsx(SettingSwitch, { label: "Use specific gear", description: gear.length ? 'Build the design around pieces you choose.' : 'Add gear in the Gear tab to use this.', checked: req.useSpecificGear, onChange: (useSpecificGear) => set({ useSpecificGear }) }), req.useSpecificGear && gear.length > 0 && (_jsx("div", { className: "chips", role: "group", "aria-label": "Gear to use", children: gear.map((g) => (_jsxs("button", { type: "button", className: "chip", "aria-pressed": req.gearIds.includes(g.id), onClick: () => set({ gearIds: req.gearIds.includes(g.id) ? req.gearIds.filter((x) => x !== g.id) : [...req.gearIds, g.id] }), children: [g.name, g.ownerId !== keys?.userId ? ' (theirs)' : ''] }, g.id))) })), req.useSpecificGear && data && !data.theirGearShown && req.partnerId && (_jsx("button", { type: "button", className: "btn btn-outline", style: { alignSelf: 'flex-start' }, onClick: () => void showTheirGear().then((n) => setGearNote(n ? '' : `${req.partnerName} isn't sharing any gear with you.`)), children: "Show their gear" })), gearNote && _jsx("p", { className: "note", style: { margin: 0 }, children: gearNote }), (data?.ctx.optedOutGear.length ?? 0) > 0 && _jsxs("p", { className: "note", style: { margin: 0 }, children: ["Gear kept out of scenes with ", req.partnerName, " isn't shown."] })] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: (!req.connectionId && !req.solo) || !data || !req.title.trim(), onClick: onNext, children: "Continue" })] }));
}
function Picks({ req, set, ctx, gear, onBack, onNext }) {
    const [adding, setAdding] = useState(false);
    const add = useAddActivity(ctx, (a, overrides) => {
        const range = ctx.top.offerings.categories[a.category];
        set({ picks: [...req.picks, { activityId: a.id, intensity: Math.min(range?.max ?? 6, 6), surprise: false }], overrides: [...req.overrides, ...overrides] });
    });
    const update = (id, patch) => set({ picks: req.picks.map((p) => (p.activityId === id ? { ...p, ...patch } : p)) });
    const remove = (id) => set({
        picks: req.picks.filter((p) => p.activityId !== id),
        overrides: req.overrides.filter((o) => o.activityId !== id),
        impactPlan: (req.impactPlan ?? []).filter((g) => g.activityId !== id)
    });
    const [open, setOpen] = useState(null);
    const grouped = categories
        .map((c) => ({ c, picks: req.picks.filter((p) => activityOf(ctx, p.activityId)?.category === c.id) }))
        .filter((g) => g.picks.length > 0);
    return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "What you'll do" }), _jsxs("p", { className: "lede", children: [req.solo && req.role === 'top' ? 'Choose what this scene includes.' : req.role === 'bottom' ? 'Things you said yes to.' : `Things ${req.partnerName} said yes to and you offer.`, " Set how far to take each one, or mark it as a surprise."] }), req.picks.length === 0 && _jsx("p", { className: "card", children: "Nothing yet. Add activities below." }), _jsx("div", { className: "stack", style: { gap: 8 }, children: grouped.map(({ c, picks }) => (_jsxs("div", { className: "stack", style: { gap: 8 }, children: [_jsxs("button", { type: "button", className: "choice", "aria-expanded": open === c.id, onClick: () => setOpen(open === c.id ? null : c.id), style: { justifyContent: 'space-between' }, children: [_jsx("span", { className: "choice-word", children: c.label }), _jsxs("span", { className: "note", children: [picks.length, " chosen ", open === c.id ? '▴' : '▾'] })] }), open === c.id && c.id === 'impact' && _jsx(GearPlan, { req: req, set: set, ctx: ctx, gear: gear }), open === c.id &&
                            picks.map((p) => {
                                const a = activityOf(ctx, p.activityId);
                                if (!a)
                                    return null;
                                return (_jsxs("section", { className: "card stack", style: { gap: 8 }, "aria-label": a.label, children: [_jsxs("div", { className: "person", children: [_jsxs("span", { style: { fontWeight: 700, display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }, children: [a.label, " ", _jsx(ActivityTag, { ctx: ctx, activity: a })] }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-label": `Remove ${a.label}`, onClick: () => remove(p.activityId), children: "Remove" })] }), _jsxs("label", { className: "field", children: [_jsxs("span", { className: "field-hint", children: ["How far: ", _jsx("strong", { children: p.intensity }), " of 10"] }), _jsx("input", { type: "range", min: 1, max: 10, step: 1, value: p.intensity, "aria-label": `How far with ${a.label}`, onChange: (e) => update(p.activityId, { intensity: Number(e.target.value) }) })] }), _jsxs("label", { className: "check", style: { minHeight: 0 }, children: [_jsx("input", { type: "checkbox", checked: p.surprise, onChange: (e) => update(p.activityId, { surprise: e.target.checked }) }), "Surprise (their preview shows a surprise, not what it is)"] })] }, p.activityId));
                            })] }, c.id))) }), adding ? (_jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Add more", children: [_jsxs("div", { className: "person", children: [_jsx("h2", { style: { margin: 0 }, children: "Add more" }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => setAdding(false), children: "Close" })] }), (ctx.intakeOf ?? 'partner') === 'partner' && (_jsx("p", { className: "note", style: { margin: 0 }, children: "Maybes and anything they didn't answer get an amber \"Discussed together?\" flag. A no needs their permission and your confirmation." })), _jsx(ActivityList, { ctx: ctx, exclude: req.picks.map((p) => p.activityId), onChoose: add.start }), add.refused && (_jsx("p", { className: "note error", role: "alert", children: add.refused }))] })) : (_jsx("button", { type: "button", className: "btn btn-outline", style: { alignSelf: 'flex-start' }, onClick: () => setAdding(true), children: "Add more" })), add.sheet, _jsx("section", { className: "card", children: _jsx(TextArea, { label: "Notes that shape the scene", hint: "Surprises, unusual combinations, anything the design should know.", value: req.notes, onChange: (notes) => set({ notes }) }) }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: !req.picks.length, onClick: onNext, children: "See designs" }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: onBack, children: "Back" })] }));
}
function Options({ req, data, busy, onBack, onChoose }) {
    const options = useMemo(() => designOptions(req, data.ctx), [req, data.ctx]);
    const [open, setOpen] = useState(null);
    return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Pick a starting design" }), _jsx("p", { className: "lede", children: "Each is a different shape. Everything stays editable." }), options.map((scene, i) => {
                const issues = validate(scene, data.ctx);
                const warn = warnings(issues).length;
                return (_jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": shapes[scene.shape].label, children: [_jsxs("div", { className: "person", children: [_jsxs("div", { children: [_jsx("div", { className: "card-title", children: shapes[scene.shape].label }), _jsx("div", { className: "note", children: sceneFacts(scene) })] }), i === 0 && data.ctx.intake?.quick?.words.flow.length ? _jsx("span", { className: "tag tag-gray", children: req.role === 'bottom' ? 'Fits your Flow' : 'Fits their Flow' }) : null] }), _jsx(MiniCurve, { scene: scene }), _jsx(PhaseStrip, { scene: scene }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: shapes[scene.shape].desc }), (warn > 0 || blocks(issues).length > 0) && (_jsxs("p", { className: "note", style: { margin: 0 }, children: [warn, " ", warn === 1 ? 'thing' : 'things', " to look at in the editor."] })), open === i && (_jsx("ol", { className: "stack", style: { gap: 4, margin: 0, paddingLeft: 20 }, children: scene.phases.map((p) => (_jsxs("li", { children: [_jsx("strong", { children: phaseLabels[p.type] }), ": ", p.beats.map((b) => `${b.title} (${b.minutes} min, intensity ${b.intensity})`).join(', ')] }, p.id))) })), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", className: "btn btn-primary", disabled: busy, onClick: () => onChoose(i), children: "Use this one" }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-expanded": open === i, onClick: () => setOpen(open === i ? null : i), children: open === i ? 'Hide preview' : 'Preview' })] })] }, scene.shape));
            }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: onBack, children: "Back" })] }));
}
/** Guesses which impact pick a piece of gear is, from its name. */
function guessActivity(name, impactIds) {
    const n = name.toLowerCase();
    const hints = [
        [/glove/, 'gloved-hand'],
        [/hand/, 'bare-hand'],
        [/paddle|strap|spoon|brush/, 'paddle'],
        [/flog/, 'flogger'],
        [/cane|rattan|switch/, 'cane'],
        [/whip|single tail|crop/, 'whip']
    ];
    return hints.find(([re, id]) => re.test(n) && impactIds.includes(id))?.[1] ?? impactIds[0];
}
/**
 * The impact gear plan: pieces in the order you want to use them, each as one
 * of your impact picks. Ember builds the impact progression from this order,
 * warm-up through the peaks.
 */
function GearPlan({ req, set, ctx, gear }) {
    const { keys } = useAccount();
    const impactPicks = req.picks.map((p) => activityOf(ctx, p.activityId)).filter((a) => a?.category === 'impact');
    const plan = req.impactPlan ?? [];
    const impactGear = gear.filter((g) => g.types.includes('impact'));
    const setPlan = (impactPlan) => set({ impactPlan });
    const nameOf = (id) => {
        const g = gear.find((x) => x.id === id);
        return g ? `${g.name}${g.ownerId !== keys?.userId ? ' (theirs)' : ''}` : 'Gear';
    };
    return (_jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": "Gear, in order", children: [_jsx("div", { className: "card-title", children: "Gear, in order" }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: "Plan the progression: list your impact gear in the order you want to use it. Ember spreads it from the warm-up to the peaks." }), !impactPicks.length ? (_jsx("p", { className: "note", style: { margin: 0 }, children: "Add an impact activity first, so each piece has something to be." })) : !impactGear.length ? (_jsxs("p", { className: "note", style: { margin: 0 }, children: ["Add impact gear in the Gear tab", req.partnerId ? ', or tap "Show their gear" in the basics' : '', " to plan it here."] })) : (_jsxs(_Fragment, { children: [_jsx("ol", { className: "stack", style: { gap: 8, margin: 0, paddingLeft: 20 }, children: plan.map((step, i) => (_jsx("li", { children: _jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("strong", { style: { flex: '1 1 120px' }, children: nameOf(step.gearId) }), _jsx("select", { className: "input", "aria-label": `${nameOf(step.gearId)} is used as`, value: step.activityId, onChange: (e) => setPlan(plan.map((x, k) => (k === i ? { ...x, activityId: e.target.value } : x))), style: { flex: '1 1 140px', minHeight: 40, padding: '6px 10px' }, children: impactPicks.map((a) => (_jsx("option", { value: a.id, children: a.label }, a.id))) }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-label": `Move ${nameOf(step.gearId)} earlier`, disabled: i === 0, onClick: () => setPlan(moved(plan, i, i - 1)), children: "\u2191" }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-label": `Move ${nameOf(step.gearId)} later`, disabled: i === plan.length - 1, onClick: () => setPlan(moved(plan, i, i + 1)), children: "\u2193" }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-label": `Remove ${nameOf(step.gearId)}`, onClick: () => setPlan(plan.filter((_, k) => k !== i)), children: "\u2715" })] }) }, `${step.gearId}-${i}`))) }), _jsxs("select", { className: "input", "aria-label": "Add gear to the plan", value: "", onChange: (e) => {
                            const g = impactGear.find((x) => x.id === e.target.value);
                            if (g)
                                setPlan([...plan, { gearId: g.id, activityId: guessActivity(g.name, impactPicks.map((a) => a.id)) }]);
                        }, children: [_jsx("option", { value: "", children: plan.length ? 'Add the next piece' : 'Add the first piece' }), impactGear.map((g) => (_jsx("option", { value: g.id, children: nameOf(g.id) }, g.id)))] })] }))] }));
}
