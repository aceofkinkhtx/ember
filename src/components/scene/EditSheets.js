import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { phaseLabels } from '../../content/phases';
import { impactAreas, impactPositions } from '../../data/activities';
import { MiniCurve, PhaseStrip } from './SceneCurve';
import { activityOf } from '../../lib/scene/rules';
import { useAccount } from '../../state/account';
import { TextArea, TextInput } from '../intake/Bits';
import { ActivityList, ActivityTag, useAddActivity } from './ActivityPicker';
// The edit sheet (S5): one sheet for a beat, one for a step. Saving runs the
// rules; a change that breaks a block rule is refused with a one-line reason
// and the sheet stays open.
const flagKinds = [
    { id: 'warning', label: 'Warning' },
    { id: 'info', label: 'Info' },
    { id: 'watch', label: 'Watch' },
    { id: 'partner', label: 'Partner' }
];
const riskTag = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };
/** The scene map as it would look after this edit, updated as you change it. */
function LiveMap({ scene }) {
    return (_jsxs("div", { className: "stack", style: { gap: 4 }, "aria-hidden": "true", children: [_jsx(MiniCurve, { scene: scene, height: 48 }), _jsx(PhaseStrip, { scene: scene })] }));
}
function Sheet({ title, children, onClose }) {
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-label": title, onClick: onClose, children: _jsxs("div", { className: "sheet", style: { maxHeight: '88vh', overflowY: 'auto' }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "person", children: [_jsx("h2", { style: { margin: 0 }, children: title }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: onClose, children: "Close" })] }), children] }) }));
}
export function BeatSheet({ beat, phaseId, phases, automatic, onSave, preview, onDelete, onClose }) {
    const [b, setB] = useState(beat);
    const [toPhase, setToPhase] = useState(phaseId);
    const [refused, setRefused] = useState('');
    const [newFlag, setNewFlag] = useState({ kind: 'info', text: '' });
    const set = (patch) => setB((x) => ({ ...x, ...patch }));
    const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    return (_jsxs(Sheet, { title: beat.title || 'Beat', onClose: onClose, children: [preview && _jsx(LiveMap, { scene: preview(b, toPhase) }), _jsx(TextInput, { label: "Goal, in one line", value: b.title, max: 80, onChange: (title) => set({ title }) }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsxs("label", { className: "field", style: { flex: 1 }, children: [_jsx("span", { className: "field-label", children: "Minutes" }), _jsx("input", { className: "input", type: "number", inputMode: "numeric", min: 1, max: 480, value: b.minutes, onChange: (e) => set({ minutes: Math.max(1, Math.min(480, Number(e.target.value) || 1)) }) })] }), _jsxs("label", { className: "field", style: { flex: 1 }, children: [_jsx("span", { className: "field-label", children: "Phase" }), _jsx("select", { className: "input", value: toPhase, onChange: (e) => setToPhase(e.target.value), children: phases.map((p, i) => (_jsxs("option", { value: p.id, children: [i + 1, ". ", phaseLabels[p.type]] }, p.id))) })] })] }), _jsxs("label", { className: "field", children: [_jsxs("span", { className: "field-label", children: ["Intensity: ", _jsx("strong", { children: b.intensity }), " of 10"] }), _jsx("input", { type: "range", min: 1, max: 10, step: 1, value: b.intensity, onChange: (e) => set({ intensity: Number(e.target.value) }) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { className: "field-label", children: "Body areas" }), _jsx("span", { className: "field-hint", children: "Risk is shown on each. The kidneys are never a target." }), _jsx("div", { className: "chips", children: impactAreas.map((a) => (_jsxs("button", { type: "button", className: "chip", "aria-pressed": b.areas.includes(a.id), onClick: () => set({ areas: toggle(b.areas, a.id) }), children: [a.label, " ", _jsxs("span", { className: "note", children: ["(", riskTag[a.risk].toLowerCase(), ")"] })] }, a.id))) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { className: "field-label", children: "Positions" }), _jsx("div", { className: "chips", children: impactPositions.map((p) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": b.positions.includes(p.id), onClick: () => set({ positions: toggle(b.positions, p.id) }), children: p.label }, p.id))) })] }), _jsxs("div", { className: "stack", style: { gap: 8 }, children: [_jsx("span", { className: "field-label", children: "Flags" }), automatic.map((f, i) => (_jsxs("p", { className: `box box-${f.kind}`, children: [f.text, " ", _jsx("span", { style: { opacity: 0.8 }, children: "(automatic)" })] }, `auto-${i}`))), b.flags.map((f, i) => (_jsxs("div", { className: "person", children: [_jsx("p", { className: `box box-${f.kind}`, style: { flex: 1 }, children: f.text }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-label": `Remove flag: ${f.text}`, onClick: () => set({ flags: b.flags.filter((_, k) => k !== i) }), children: "Remove" })] }, i))), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("select", { className: "input", "aria-label": "Flag type", value: newFlag.kind, onChange: (e) => setNewFlag({ ...newFlag, kind: e.target.value }), style: { flex: '0 0 auto' }, children: flagKinds.map((k) => (_jsx("option", { value: k.id, children: k.label }, k.id))) }), _jsx("input", { className: "input", "aria-label": "Flag text", maxLength: 160, value: newFlag.text, onChange: (e) => setNewFlag({ ...newFlag, text: e.target.value }), style: { flex: 1, minWidth: 140 } }), _jsx("button", { type: "button", className: "btn btn-secondary", disabled: !newFlag.text.trim(), onClick: () => {
                                    set({ flags: [...b.flags, { kind: newFlag.kind, text: newFlag.text.trim(), urgent: newFlag.kind === 'warning' }] });
                                    setNewFlag({ ...newFlag, text: '' });
                                }, children: "Add flag" })] })] }), refused && (_jsx("p", { className: "box box-block", role: "alert", children: refused })), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => {
                    const reason = onSave(b, toPhase);
                    if (reason)
                        setRefused(reason);
                    else
                        onClose();
                }, children: "Save beat" }), _jsx("button", { type: "button", className: "btn btn-outline btn-block", onClick: () => {
                    const reason = onDelete();
                    if (reason)
                        setRefused(reason);
                    else
                        onClose();
                }, children: "Delete beat" })] }));
}
export function StepSheet({ step, beatId, phases, ctx, gear, onSave, onDelete, onClose }) {
    const [s, setS] = useState(step);
    const [toBeat, setToBeat] = useState(beatId);
    const [overrides, setOverrides] = useState([]);
    const [choosing, setChoosing] = useState(false);
    const [refused, setRefused] = useState('');
    const set = (patch) => setS((x) => ({ ...x, ...patch }));
    const activity = activityOf(ctx, s.activityId);
    const add = useAddActivity(ctx, (a, more) => {
        set({ activityId: a.id });
        setOverrides((o) => [...o, ...more]);
        setChoosing(false);
    });
    const { keys } = useAccount();
    const usable = gear.filter((g) => !ctx.optedOutGear.includes(g.id) || g.id === s.gearId);
    return (_jsxs(Sheet, { title: activity?.label ?? 'Step', onClose: onClose, children: [_jsxs("div", { className: "stack", style: { gap: 6 }, children: [_jsx("span", { className: "field-label", children: "Activity" }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("span", { style: { fontWeight: 700 }, children: activity ? activity.label : 'None (a care or connection step)' }), activity && _jsx(ActivityTag, { ctx: ctx, activity: activity }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => setChoosing((c) => !c), children: choosing ? 'Cancel' : 'Change' }), activity && (_jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => set({ activityId: null }), children: "Clear" }))] }), choosing && _jsx(ActivityList, { ctx: ctx, exclude: s.activityId ? [s.activityId] : [], onChoose: add.start }), add.refused && (_jsx("p", { className: "box box-block", role: "alert", children: add.refused }))] }), usable.length > 0 && (_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Gear" }), _jsxs("select", { className: "input", value: s.gearId ?? '', onChange: (e) => set({ gearId: e.target.value || null }), children: [_jsx("option", { value: "", children: "None" }), usable.map((g) => (_jsxs("option", { value: g.id, children: [g.name, g.ownerId !== keys?.userId ? ' (theirs)' : ''] }, g.id)))] })] })), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "In which beat" }), _jsx("span", { className: "field-hint", children: "Move this step anywhere in the scene." }), _jsx("select", { className: "input", value: toBeat, onChange: (e) => setToBeat(e.target.value), children: phases.map((p) => p.beats.map((b) => (_jsxs("option", { value: b.id, children: [phaseLabels[p.type], ": ", b.title || 'Untitled beat'] }, b.id)))) })] }), _jsx(TextArea, { label: "DO", hint: "What you do.", value: s.do, rows: 3, max: 600, onChange: (v) => set({ do: v }) }), _jsx(TextArea, { label: "SAY", hint: "Words to say, in your voice.", value: s.say, rows: 2, max: 400, onChange: (v) => set({ say: v }) }), _jsx(TextArea, { label: "WATCH", hint: "Signals to look for, beyond the core watch list.", value: s.watch, rows: 2, max: 400, onChange: (v) => set({ watch: v }) }), _jsx(TextArea, { label: "NOTES", value: s.notes, rows: 2, max: 600, onChange: (v) => set({ notes: v }) }), _jsxs("label", { className: "check", style: { minHeight: 0 }, children: [_jsx("input", { type: "checkbox", checked: s.surprise, onChange: (e) => set({ surprise: e.target.checked }) }), "Surprise (their preview shows a surprise, not what it is)"] }), add.sheet, refused && (_jsx("p", { className: "box box-block", role: "alert", children: refused })), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => {
                    const reason = onSave(s, overrides, toBeat);
                    if (reason)
                        setRefused(reason);
                    else
                        onClose();
                }, children: "Save step" }), _jsx("button", { type: "button", className: "btn btn-outline btn-block", onClick: () => {
                    const reason = onDelete();
                    if (reason)
                        setRefused(reason);
                    else
                        onClose();
                }, children: "Delete step" })] }));
}
/** Set a length in minutes: a whole section, or the scene's play time. */
export function MinutesSheet({ title, hint, value, min, max, onSave, preview, onClose }) {
    const [minutes, setMinutes] = useState(value);
    const [refused, setRefused] = useState('');
    const label = `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() || '0 min';
    return (_jsxs(Sheet, { title: title, onClose: onClose, children: [preview && _jsx(LiveMap, { scene: preview(minutes) }), _jsx("p", { className: "note", style: { margin: 0 }, children: hint }), _jsxs("label", { className: "field", children: [_jsxs("span", { className: "field-label", children: ["Length: ", _jsx("strong", { children: label })] }), _jsx("input", { type: "range", min: min, max: max, step: 1, value: minutes, "aria-valuetext": label, onChange: (e) => setMinutes(Number(e.target.value)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Or type minutes" }), _jsx("input", { className: "input", type: "number", inputMode: "numeric", min: min, max: max, value: minutes, onChange: (e) => setMinutes(Math.max(min, Math.min(max, Number(e.target.value) || min))) })] }), refused && (_jsx("p", { className: "box box-block", role: "alert", children: refused })), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => {
                    const reason = onSave(minutes);
                    if (reason)
                        setRefused(reason);
                    else
                        onClose();
                }, children: "Save" })] }));
}
