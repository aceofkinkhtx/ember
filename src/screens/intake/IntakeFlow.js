import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { BodyMap } from '../../components/intake/BodyMap';
import { Chips, OneOf, Section, Segments, TextArea, TextInput } from '../../components/intake/Bits';
import { IntakeSummary } from '../../components/intake/IntakeSummary';
import { MapPicker } from '../../components/intake/MapPicker';
import { aftercareMap, contactAwareness, decoderAnswers, desireMap, honorifics, overwhelmExamples, presenceAnswers, presenceQuestions, triggerExamples, wordGroups } from '../../content/intake';
import { aftercareExtras, categories, experienceLevels, feels, impactAreas, impactPositions, markOptions, speakUpLevels } from '../../data/activities';
import { allActivities, emptyAftercare, emptyDetailed, essentialsMissing, mergeChange } from '../../lib/intake';
function stepsFor(paths) {
    const steps = ['signals', 'safety', 'body', 'paths'];
    if (paths.includes('quick'))
        for (const g of wordGroups)
            steps.push(`group-${g.id}`, `decoder-${g.id}`);
    if (paths.includes('map'))
        steps.push('desire-map');
    if (paths.includes('detailed')) {
        steps.push('my-body');
        for (const c of categories)
            steps.push(`cat-${c.id}`);
        steps.push('impact', 'words');
    }
    steps.push('aftercare', 'review');
    return steps;
}
const pathCards = [
    { id: 'quick', label: 'Quick', desc: 'Three groups of words: Heat, Hold and Flow. About 3 minutes.' },
    { id: 'map', label: 'Map', desc: 'Place one dot on the desire map. About 1 minute.' },
    { id: 'detailed', label: 'Detailed', desc: 'Yes, maybe or no for every activity. About 10 minutes.' }
];
export function IntakeFlow({ value, onChange: report, review, title = 'Your intake', startAt = 0 }) {
    // Every change is reapplied on top of the newest answers, so quick taps never undo each other.
    const latest = useRef(value);
    latest.current = value;
    const onChange = (next) => {
        latest.current = mergeChange(value, next, latest.current);
        report(latest.current);
    };
    const steps = useMemo(() => stepsFor(value.paths), [value.paths]);
    const [index, setIndex] = useState(Math.min(startAt, steps.length - 1));
    const step = steps[Math.min(index, steps.length - 1)];
    // The screen itself scrolls, not the window, so each new step starts at its top.
    const screenRef = useRef(null);
    useEffect(() => {
        screenRef.current?.scrollTo?.(0, 0);
        window.scrollTo?.(0, 0);
    }, [index]);
    const stamp = (section) => ({ ...value.updated, [section]: new Date().toISOString() });
    const setE = (patch) => onChange({ ...value, essentials: { ...value.essentials, ...patch }, updated: stamp('essentials') });
    const blocked = blockedReason(step, value);
    return (_jsxs("main", { className: "screen", ref: screenRef, children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: title }), _jsx("div", { className: "progress-bar", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": steps.length, "aria-valuenow": index + 1, "aria-label": `Step ${index + 1} of ${steps.length}`, children: _jsx("span", { style: { width: `${((index + 1) / steps.length) * 100}%` } }) })] }), _jsx(StepBody, { step: step, intake: value, onChange: onChange, setE: setE, stamp: stamp, review: review }), step !== 'review' && (_jsxs("footer", { className: "stack", style: { gap: 8 }, children: [blocked && _jsx("p", { className: "note", children: blocked }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: Boolean(blocked), onClick: () => setIndex(index + 1), children: "Continue" }), step.startsWith('decoder-') && (_jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => setIndex(index + 1), children: "Skip this question" }))] })), index > 0 && (_jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => setIndex(index - 1), children: "Back" }))] }));
}
function blockedReason(step, intake) {
    if (step === 'safety') {
        const missing = essentialsMissing(intake.essentials);
        return missing.length ? `To continue, add ${missing.join(' and ')}.` : '';
    }
    if (step === 'paths' && intake.paths.length === 0)
        return 'Choose at least one way to share.';
    if (step.startsWith('group-')) {
        const g = step.slice(6);
        if (!intake.quick?.words[g]?.length)
            return 'Pick one or two words to continue.';
    }
    return '';
}
function StepBody({ step, intake, onChange, setE, stamp, review }) {
    const e = intake.essentials;
    if (step === 'signals') {
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "The essentials" }), _jsx("p", { className: "lede", children: "What every Top needs to know, whichever way you share the rest." }), _jsx(Section, { title: "Signals", children: _jsxs("div", { className: "stack", style: { gap: 12 }, children: [_jsx(TextInput, { label: "Green: keep going", value: e.signals.green, onChange: (green) => setE({ signals: { ...e.signals, green } }), max: 30 }), _jsx(TextInput, { label: "Yellow: slow down or check in", value: e.signals.yellow, onChange: (yellow) => setE({ signals: { ...e.signals, yellow } }), max: 30 }), _jsx(TextInput, { label: "Red: stop now", value: e.signals.red, onChange: (red) => setE({ signals: { ...e.signals, red } }), max: 30 }), _jsx(TextInput, { label: "Hand signal", hint: "For when you can't speak.", value: e.signals.handSign, onChange: (handSign) => setE({ signals: { ...e.signals, handSign } }) }), _jsx(TextInput, { label: "Any other signal (optional)", value: e.signals.custom, onChange: (custom) => setE({ signals: { ...e.signals, custom } }) })] }) }), _jsxs(Section, { title: "Experience and voice", children: [_jsx(OneOf, { legend: "How much experience do you have?", options: experienceLevels, value: e.experience, onChange: (experience) => setE({ experience }) }), _jsx(OneOf, { legend: "When something is wrong in a scene, how easily do you speak up?", hint: "There's no wrong answer. This tells your Top how often to check in.", options: speakUpLevels, value: e.speakUp, onChange: (speakUp) => setE({ speakUp }) })] }), _jsxs(Section, { title: "What to call you in a scene", children: [_jsx(Chips, { legend: "Honorifics you like", hint: "Pick any.", options: honorifics.map((h) => ({ id: h, label: h })), value: e.honorifics, onChange: (h) => setE({ honorifics: h }) }), _jsx(TextInput, { label: "Or write your own", value: e.honorificCustom, onChange: (honorificCustom) => setE({ honorificCustom }), max: 40 })] })] }));
    }
    if (step === 'body') {
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Body and mind" }), _jsx("p", { className: "lede", children: "Share what helps your Top keep you safe. Everything here is optional." }), _jsxs(Section, { title: "Body", children: [_jsx(BodyMap, { legend: "Anywhere with an injury, pain or a note?", hint: "Tap the outline or the names.", value: e.body.areas, onChange: (areas) => setE({ body: { ...e.body, areas } }) }), _jsx(TextArea, { label: "Injuries, health and mobility", hint: "Medical conditions, positions that don't work, anything your Top should plan around.", value: e.body.notes, onChange: (notes) => setE({ body: { ...e.body, notes } }) }), _jsx(TextInput, { label: "Allergies", value: e.body.allergies, onChange: (allergies) => setE({ body: { ...e.body, allergies } }), max: 200 })] }), _jsxs(Section, { title: "Mind", children: [_jsx(Chips, { legend: "Triggers", hint: "Tap any examples that fit, or write your own. Share only what you want to.", options: triggerExamples.map((t) => ({ id: t, label: t })), value: e.triggers.chips, onChange: (chips) => setE({ triggers: { ...e.triggers, chips } }) }), _jsx(TextArea, { label: "Other triggers", value: e.triggers.notes, onChange: (notes) => setE({ triggers: { ...e.triggers, notes } }) }), _jsx(Chips, { legend: "If you get overwhelmed, what helps?", options: overwhelmExamples.map((t) => ({ id: t, label: t })), value: e.overwhelm.chips, onChange: (chips) => setE({ overwhelm: { ...e.overwhelm, chips } }) }), _jsx(TextArea, { label: "Anything else that helps, or to avoid", value: e.overwhelm.notes, onChange: (notes) => setE({ overwhelm: { ...e.overwhelm, notes } }) })] })] }));
    }
    if (step === 'safety') {
        const em = e.emergency;
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Safety" }), _jsxs(Section, { title: "Emergency contact", children: [_jsx(Segments, { label: "If something goes wrong, who should your Top contact?", options: [
                                { id: 'person', label: 'Someone I trust' },
                                { id: '911', label: 'Call 911' }
                            ], value: em?.kind ?? null, onChange: (kind) => setE({ emergency: kind === '911' ? { kind: '911' } : { kind: 'person', name: '', phone: '', aware: null } }) }), em?.kind === 'person' && (_jsxs(_Fragment, { children: [_jsx(TextInput, { label: "Their name", value: em.name, onChange: (name) => setE({ emergency: { ...em, name } }), max: 60 }), _jsx(TextInput, { label: "Their phone number", type: "tel", autoComplete: "off", value: em.phone, onChange: (phone) => setE({ emergency: { ...em, phone } }), max: 30 }), _jsx(Segments, { label: "Do they know about kink?", options: [...contactAwareness], value: em.aware, onChange: (aware) => setE({ emergency: { ...em, aware } }) })] })), em?.kind === '911' && _jsx("p", { className: "note", children: "Your Top will call 911 in an emergency and won't need anyone's details." })] }), _jsxs(Section, { title: "Limits", children: [_jsx(TextArea, { label: "Hard limits", hint: "Anything that's always a no. If you choose the detailed path, your no answers are added too.", value: e.limits?.hard ?? '', onChange: (hard) => setE({ limits: { ...(e.limits ?? { hard: '', soft: '' }), hard } }), rows: 2 }), _jsx(TextArea, { label: "Soft limits", hint: "Things that might be okay, but only after you talk.", value: e.limits?.soft ?? '', onChange: (soft) => setE({ limits: { ...(e.limits ?? { hard: '', soft: '' }), soft } }), rows: 2 })] }), _jsx(Section, { title: "Substances", children: _jsxs("label", { className: "check", children: [_jsx("input", { type: "checkbox", checked: Boolean(e.substanceAgreedAt), onChange: (ev) => setE({ substanceAgreedAt: ev.target.checked ? new Date().toISOString() : null }) }), "I agree to no play when either of us is noticeably intoxicated."] }) }), _jsx(Section, { title: "Your no means no", children: _jsxs("label", { className: "check", style: { alignItems: 'flex-start' }, children: [_jsx("input", { type: "checkbox", checked: e.allowNoOverride.on, onChange: (ev) => setE({ allowNoOverride: { on: ev.target.checked, changedAt: new Date().toISOString() } }) }), _jsxs("span", { children: ["My Top may override a no after we talk", _jsx("span", { className: "note", style: { display: 'block', fontWeight: 400 }, children: "Off by default. While it's off, every no is a hard block that no Top can add to a scene." })] })] }) })] }));
    }
    if (step === 'paths') {
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "How would you like to share your desires?" }), _jsx("p", { className: "lede", children: "Pick one, or more than one. You can come back and do another anytime." }), _jsx("div", { className: "stack", children: pathCards.map((p) => (_jsx("button", { type: "button", className: "choice", role: "checkbox", "aria-checked": intake.paths.includes(p.id), onClick: () => {
                            const paths = intake.paths.includes(p.id) ? intake.paths.filter((x) => x !== p.id) : [...intake.paths, p.id];
                            onChange({
                                ...intake,
                                paths: ['quick', 'map', 'detailed'].filter((x) => paths.includes(x)),
                                quick: paths.includes('quick') ? (intake.quick ?? { words: { heat: [], hold: [], flow: [] }, decoder: {} }) : intake.quick,
                                detailed: paths.includes('detailed') ? (intake.detailed ?? emptyDetailed()) : intake.detailed
                            });
                        }, children: _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: p.label }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: p.desc })] }) }, p.id))) })] }));
    }
    if (step.startsWith('group-') && intake.quick) {
        const g = wordGroups.find((x) => x.id === step.slice(6));
        const quick = intake.quick;
        const picked = quick.words[g.id];
        return (_jsxs(_Fragment, { children: [_jsx("div", { className: "eyebrow", children: g.title }), _jsx("h1", { children: g.question }), _jsx("p", { className: "lede", children: "Pick one or two." }), _jsx("div", { className: "stack", children: g.words.map((w) => (_jsx("button", { type: "button", className: "choice", role: "checkbox", "aria-checked": picked.includes(w.id), onClick: () => {
                            const next = picked.includes(w.id) ? picked.filter((x) => x !== w.id) : [...picked, w.id].slice(-2);
                            onChange({ ...intake, quick: { ...quick, words: { ...quick.words, [g.id]: next } }, updated: stamp('quick') });
                        }, children: _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: w.label }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: w.desc })] }) }, w.id))) })] }));
    }
    if (step.startsWith('decoder-') && intake.quick) {
        const g = wordGroups.find((x) => x.id === step.slice(8));
        const quick = intake.quick;
        const words = quick.words[g.id].map((id) => g.words.find((w) => w.id === id)?.label).filter(Boolean);
        return (_jsxs(_Fragment, { children: [_jsx("div", { className: "eyebrow", children: g.title }), _jsxs("h1", { children: ["What does ", words.join(' and ') || 'this', " do for you?"] }), _jsx("p", { className: "lede", children: "Pick what fits. It shapes the scene more than the activities do." }), _jsx("div", { className: "stack", children: decoderAnswers.map((d) => {
                        const chosen = quick.decoder[g.id] ?? [];
                        return (_jsx("button", { type: "button", className: "choice", role: "checkbox", "aria-checked": chosen.includes(d.id), onClick: () => {
                                const next = chosen.includes(d.id) ? chosen.filter((x) => x !== d.id) : [...chosen, d.id];
                                onChange({ ...intake, quick: { ...quick, decoder: { ...quick.decoder, [g.id]: next } }, updated: stamp('quick') });
                            }, children: _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: d.label }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: d.desc })] }) }, d.id));
                    }) })] }));
    }
    if (step === 'desire-map') {
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Where do you want this scene to take you?" }), _jsx("p", { className: "lede", children: "Place one dot. Its exact spot matters, so a dot near the middle means a little of everything." }), _jsx(MapPicker, { map: desireMap, value: intake.desireMap, onChange: (desireMapDot) => onChange({ ...intake, desireMap: desireMapDot, updated: stamp('desireMap') }) })] }));
    }
    if (step === 'my-body') {
        const body = intake.myBody ?? { frontHole: null, wordsWelcome: '', wordsAvoid: '' };
        const set = (patch) => onChange({ ...intake, myBody: { ...body, ...patch }, updated: stamp('detailed') });
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "My body" }), _jsx("p", { className: "lede", children: "Optional. This only decides which activities you see and the words Ember and your Top use." }), _jsx(Section, { title: "Activities to show", children: _jsx(Segments, { label: "Show activities for a vagina or front hole?", options: [
                            { id: 'yes', label: 'Yes' },
                            { id: 'no', label: 'No' },
                            { id: 'all', label: 'Show everything' }
                        ], value: body.frontHole === null ? 'all' : body.frontHole ? 'yes' : 'no', onChange: (v) => set({ frontHole: v === 'all' ? null : v === 'yes' }) }) }), _jsxs(Section, { title: "Words for your body", children: [_jsx(TextArea, { label: "Words you like for your body", hint: "For example, the words you use for your chest or genitals.", value: body.wordsWelcome, onChange: (wordsWelcome) => set({ wordsWelcome }), rows: 2 }), _jsx(TextArea, { label: "Words to avoid", value: body.wordsAvoid, onChange: (wordsAvoid) => set({ wordsAvoid }), rows: 2 })] })] }));
    }
    if (step.startsWith('cat-')) {
        const cat = categories.find((c) => c.id === step.slice(4));
        return _jsx(CategoryStep, { category: cat, intake: intake, onChange: onChange, stamp: stamp });
    }
    if (step === 'impact' && intake.detailed) {
        const d = intake.detailed;
        const set = (patch) => onChange({ ...intake, detailed: { ...d, impact: { ...d.impact, ...patch } }, updated: stamp('detailed') });
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Impact details" }), _jsxs(Section, { title: "Where", children: [_jsx(Chips, { legend: "Areas that are okay", hint: "Higher-risk areas are marked.", options: impactAreas.map((a) => ({ id: a.id, label: a.risk === 'low' ? a.label : `${a.label} (${a.risk} risk)` })), value: d.impact.areas, onChange: (areas) => set({ areas }) }), _jsx(Chips, { legend: "Positions", options: impactPositions, value: d.impact.positions, onChange: (positions) => set({ positions }) })] }), _jsxs(Section, { title: "How", children: [_jsx(Chips, { legend: "Feel", options: feels.map((f) => ({ id: f, label: f })), value: d.impact.feel, onChange: (feel) => set({ feel: feel }) }), _jsx(Segments, { label: "Marks", options: markOptions, value: d.impact.marks, onChange: (marks) => set({ marks }) }), _jsx("p", { className: "note", children: "Marks are confirmed again for each scene." })] })] }));
    }
    if (step === 'words' && intake.detailed) {
        const d = intake.detailed;
        const setD = (patch) => onChange({ ...intake, detailed: { ...d, ...patch }, updated: stamp('detailed') });
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Limits and language" }), _jsx("p", { className: "lede", children: "Your no answers already fill your limit strip. Add anything else here." }), _jsxs(Section, { title: "Words", children: [_jsx(TextArea, { label: "Words welcome", hint: "Names, praise or degradation you enjoy.", value: d.words.welcome, onChange: (welcome) => setD({ words: { ...d.words, welcome } }), rows: 2 }), _jsx(TextArea, { label: "Words off-limits", value: d.words.offLimits, onChange: (offLimits) => setD({ words: { ...d.words, offLimits } }), rows: 2 })] }), _jsxs(Section, { title: "Limits", children: [_jsx(TextArea, { label: "Any other hard no", value: d.limits.hardExtra, onChange: (hardExtra) => setD({ limits: { ...d.limits, hardExtra } }), rows: 2 }), _jsx(TextArea, { label: "Places not to be touched", value: d.limits.noTouch, onChange: (noTouch) => setD({ limits: { ...d.limits, noTouch } }), rows: 2 })] })] }));
    }
    if (step === 'aftercare') {
        const a = intake.aftercare ?? emptyAftercare();
        const set = (patch) => onChange({ ...intake, aftercare: { ...a, ...patch }, updated: stamp('aftercare') });
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Aftercare" }), _jsx("p", { className: "lede", children: "How you want to come back after the scene." }), _jsx(Section, { title: "Right after", children: _jsx(MapPicker, { map: aftercareMap, value: a.map, onChange: (map) => set({ map }) }) }), _jsx(Section, { title: "The next day (optional)", children: a.nextDay ? (_jsxs(_Fragment, { children: [_jsx(MapPicker, { map: aftercareMap, value: a.nextDay, onChange: (nextDay) => set({ nextDay }) }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => set({ nextDay: null }), children: "Remove the next-day dot" })] })) : (_jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => set({ nextDay: { x: 0, y: 0 } }), children: "Add a dot for the next day" })) }), _jsx(Section, { title: "Extras", children: _jsx(Chips, { legend: "What helps", options: aftercareExtras.map((x) => ({ id: x, label: x })), value: a.extras, onChange: (extras) => set({ extras }) }) }), _jsx(Section, { title: "Presence and privacy", children: presenceQuestions.map((q) => (_jsx(Segments, { label: q.label, options: presenceAnswers, value: a.presence[q.id], onChange: (ans) => set({ presence: { ...a.presence, [q.id]: ans } }) }, q.id))) }), _jsx(Section, { title: "Curiosity", children: _jsx(TextArea, { label: "Anything you're curious about but haven't tried?", value: a.curiosity, onChange: (curiosity) => set({ curiosity }), rows: 2 }) })] }));
    }
    if (step === 'review') {
        return (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Review" }), _jsx("p", { className: "lede", children: "This is what a Top sees when you share your full profile. Go back to change anything." }), _jsx(IntakeSummary, { intake: intake }), review(intake)] }));
    }
    return null;
}
function CategoryStep({ category, intake, onChange, stamp }) {
    const d = intake.detailed ?? emptyDetailed();
    const [adding, setAdding] = useState('');
    const items = allActivities(d, intake.myBody).filter((a) => a.category === category.id);
    const setAnswer = (id, next) => {
        const answers = { ...d.answers };
        if (next)
            answers[id] = next;
        else
            delete answers[id];
        onChange({ ...intake, detailed: { ...d, answers }, updated: stamp('detailed') });
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "eyebrow", children: "Detailed" }), _jsx("h1", { children: category.label }), _jsx("p", { className: "lede", children: "Yes, maybe or no for each. Anything you leave blank is never read as a yes." }), _jsx("ul", { className: "person-list", children: items.map((a) => {
                    const ans = d.answers[a.id];
                    return (_jsxs("li", { className: "card stack", style: { gap: 8 }, children: [_jsxs("div", { className: "person-name", style: { fontSize: 16 }, children: [a.label, a.edge && _jsx("span", { className: "note", children: " \u00B7 edge play, always negotiated first" }), a.negotiatedOnly && !a.edge && _jsx("span", { className: "note", children: " \u00B7 only when negotiated" })] }), _jsx("div", { className: "segmented", role: "radiogroup", "aria-label": a.label, style: { alignSelf: 'flex-start' }, children: ['yes', 'maybe', 'no'].map((c) => (_jsx("button", { type: "button", role: "radio", "aria-checked": ans?.choice === c, onClick: () => setAnswer(a.id, ans?.choice === c ? null : { choice: c, intensity: c === 'yes' ? (ans?.intensity ?? 3) : undefined }), children: c === 'yes' ? 'Yes' : c === 'maybe' ? 'Maybe' : 'No' }, c))) }), ans?.choice === 'yes' && (_jsxs("label", { className: "note", style: { display: 'flex', alignItems: 'center', gap: 10 }, children: ["Intensity", _jsx("input", { type: "range", min: 1, max: 5, value: ans.intensity ?? 3, "aria-label": `${a.label} intensity`, onChange: (e) => setAnswer(a.id, { choice: 'yes', intensity: Number(e.target.value) }), style: { flex: 1 } }), ans.intensity ?? 3, " of 5"] }))] }, a.id));
                }) }), _jsxs("form", { className: "card stack", onSubmit: (e) => {
                    e.preventDefault();
                    const label = adding.trim();
                    if (!label)
                        return;
                    const custom = { id: `custom-${Date.now().toString(36)}`, label, category: category.id, custom: true };
                    onChange({ ...intake, detailed: { ...d, custom: [...d.custom, custom] }, updated: stamp('detailed') });
                    setAdding('');
                }, children: [_jsx(TextInput, { label: `Add your own to ${category.label.toLowerCase()}`, value: adding, onChange: setAdding, max: 60 }), _jsx("button", { type: "submit", className: "btn btn-secondary", disabled: !adding.trim(), children: "Add" })] })] }));
}
