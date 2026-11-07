import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { checkInQuestions } from '../../content/checkins';
import { bottomCheckMissing, emptyBottomCheck, readinessIngredients } from '../../lib/scene/live';
import { Chips, Segments, TextArea } from '../intake/Bits';
// The bottom's part of the pre-scene check (M6): how they are today, every
// maybe in the plan answered yes, no or "let's talk", and their readiness.
// Used on the bottom's own phone, or on the Top's phone handed over.
const five = ['1', '2', '3', '4', '5'].map((id) => ({ id, label: id }));
function Scale({ label, low, high, value, onChange }) {
    return (_jsxs("div", { className: "stack", style: { gap: 2 }, children: [_jsx(Segments, { label: label, options: five, value: value ? String(value) : null, onChange: (v) => onChange(Number(v)) }), _jsxs("span", { className: "note", children: ["1 is ", low.toLowerCase(), ", 5 is ", high.toLowerCase()] })] }));
}
const maybeOptions = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
    { id: 'talk', label: "Let's talk" }
];
export function BottomCheckForm({ topName, maybes, onTopPhone = false, onSend }) {
    const [c, setC] = useState(emptyBottomCheck());
    const [negotiated, setNegotiated] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const set = (patch) => setC((x) => ({ ...x, ...patch }));
    const [feeling, negotiation, excitement] = checkInQuestions('pre', 'bottom');
    const missing = [...bottomCheckMissing(c, maybes), ...(negotiated ? [] : ['the final negotiation question'])];
    return (_jsxs("div", { className: "stack", style: { gap: 18 }, children: [maybes.length > 0 && (_jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Maybes in the plan", children: [_jsx("div", { className: "eyebrow", children: "Maybes in the plan" }), _jsxs("p", { className: "setting-desc", style: { margin: 0 }, children: [topName, " included ", maybes.length === 1 ? 'something you marked maybe or didn\'t answer' : `${maybes.length} things you marked maybe or didn't answer`, ". Each one needs your answer before the scene. A no takes it out of the plan."] }), maybes.map((m) => (_jsx(Segments, { label: m.label, options: maybeOptions, value: c.maybes[m.activityId], onChange: (a) => set({ maybes: { ...c.maybes, [m.activityId]: a } }) }, m.activityId)))] })), _jsxs("section", { className: "card stack", style: { gap: 14 }, "aria-label": "How you are today", children: [_jsx("div", { className: "eyebrow", children: "How you are today" }), feeling.kind === 'scale' && _jsx(Scale, { label: feeling.prompt, low: feeling.low, high: feeling.high, value: c.feeling, onChange: (feeling) => set({ feeling }) }), _jsx(Scale, { label: "How does your body feel today?", low: "Sore or tired", high: "Great", value: c.body, onChange: (body) => set({ body }) }), _jsx(TextArea, { label: "Anything sore, new or to avoid today? (optional)", rows: 2, max: 300, value: c.bodyNote, onChange: (bodyNote) => set({ bodyNote }) }), _jsx(Scale, { label: "How are you feeling emotionally, going in?", low: "Heavy", high: "Light and ready", value: c.emotion, onChange: (emotion) => set({ emotion }) }), _jsx(TextArea, { label: "Anything on your mind? (optional)", rows: 2, max: 300, value: c.emotionNote, onChange: (emotionNote) => set({ emotionNote }) }), excitement.kind === 'scale' && _jsx(Scale, { label: excitement.prompt, low: excitement.low, high: excitement.high, value: c.excitement, onChange: (excitement) => set({ excitement }) })] }), _jsxs("section", { className: "card stack", style: { gap: 14 }, "aria-label": "Since you last talked", children: [_jsx(Segments, { label: negotiation.prompt, options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], value: negotiated, onChange: (v) => { setNegotiated(v); set({ finalNegotiation: v === 'yes' }); } }), _jsx(Segments, { label: "Anything new since you last talked about this scene?", options: [{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }], value: c.anythingNew ? 'yes' : 'no', onChange: (v) => set({ anythingNew: v === 'yes' }) }), c.anythingNew && _jsx(TextArea, { label: "What's new?", rows: 2, max: 500, value: c.newNote, onChange: (newNote) => set({ newNote }) }), _jsxs("label", { className: "choice", style: { alignItems: 'center' }, children: [_jsx("input", { type: "checkbox", checked: c.substanceToday, onChange: (e) => set({ substanceToday: e.target.checked }), style: { width: 22, height: 22 } }), _jsx("span", { children: "I'm keeping to our substance agreement today." })] })] }), _jsx("section", { className: "card stack", style: { gap: 10 }, "aria-label": "Your yes today", children: _jsx(Chips, { legend: "Which parts of your yes are here today?", hint: "Tap all that feel true. Anything missing is worth saying out loud.", options: readinessIngredients.map((r) => ({ id: r, label: r })), value: c.readiness, onChange: (readiness) => set({ readiness }) }) }), error && (_jsx("p", { className: "box box-block", role: "alert", children: error })), missing.length > 0 && _jsxs("p", { className: "note", children: ["Still to answer: ", missing.join(', '), "."] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy || missing.length > 0, onClick: async () => {
                    setBusy(true);
                    setError('');
                    const err = await onSend({ ...c, answeredAt: new Date().toISOString(), onTopPhone: onTopPhone || undefined });
                    setBusy(false);
                    if (err)
                        setError(err);
                }, children: onTopPhone ? 'Done, hand the phone back' : `Send to ${topName}` })] }));
}
