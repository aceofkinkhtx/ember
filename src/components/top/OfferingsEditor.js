import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { activities as builtIn, categories } from '../../data/activities';
import { DEGREE_RANGE, allTopActivities, available, clampRange, defaultRange, degreeEnds, isOffered, rangeText } from '../../content/topSetup';
import { TextInput } from '../intake/Bits';
import { RangePair } from '../RangePair';
import { SettingSwitch } from '../Switch';
// O4 and Me > Offerings: what this Top does, and how far they go. Each category
// is a switch with a range slider; inside it, every activity is a chip that is
// on unless the Top turns it off. Press and hold a chip to rename it. Edge play
// shows only in Studio mode, and penile or oral sex only when the Top allows it
// in their settings.
const intro = {
    bondage: 'Restraint, from blindfolds and cuffs to rope and furniture.',
    sensation: 'Wax, biting, tickling, scratching, electricity and more.',
    impact: 'Hands, paddles, floggers, canes and whips.',
    touch: 'Cuddling, kissing and intimate touch.',
    penetration: 'Fingers, toys, and penis or strap-on.'
};
const HOLD_MS = 550;
export function OfferingsEditor({ setup, studio, onChange }) {
    const [renaming, setRenaming] = useState(null);
    return (_jsxs("div", { className: "stack", style: { gap: 14 }, children: [categories.map((c) => (_jsx(CategoryCard, { id: c.id, label: c.label, setup: setup, studio: studio, onChange: onChange, onRename: setRenaming }, c.id))), renaming && _jsx(RenameSheet, { activity: renaming, onChange: onChange, onClose: () => setRenaming(null) })] }));
}
function CategoryCard({ id, label, setup, studio, onChange, onRename }) {
    const [adding, setAdding] = useState('');
    const [renameMode, setRenameMode] = useState(false);
    const cat = setup.offerings.categories[id];
    const on = Boolean(cat?.on);
    const range = cat ? { min: cat.min, max: cat.max } : defaultRange();
    const items = allTopActivities(setup.offerings).filter((a) => a.category === id && available(a, setup.settings, studio));
    const setCategory = (patch) => onChange((o) => ({ ...o, categories: { ...o.categories, [id]: { on, ...range, ...o.categories[id], ...patch } } }));
    const toggleActivity = (a) => onChange((o) => ({ ...o, activities: { ...o.activities, [a.id]: !isOffered({ ...setup, offerings: o }, a, studio) } }));
    function addOwn() {
        const label = adding.trim();
        if (!label)
            return;
        const activity = { id: `custom-${crypto.randomUUID()}`, label, category: id, custom: true };
        onChange((o) => ({ ...o, custom: [...o.custom, activity] }));
        setAdding('');
    }
    const removeOwn = (a) => onChange((o) => {
        const { [a.id]: _gone, ...rest } = o.activities;
        return { ...o, custom: o.custom.filter((x) => x.id !== a.id), activities: rest };
    });
    return (_jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": label, children: [_jsx(SettingSwitch, { label: label, description: intro[id], checked: on, onChange: (next) => setCategory({ on: next }) }), on && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsxs("span", { className: "field-label", style: { fontSize: 16 }, children: ["How far you go: ", _jsx("strong", { children: rangeText(range) })] }), _jsx(RangePair, { label: `How far you go with ${label.toLowerCase()}`, min: DEGREE_RANGE.min, max: DEGREE_RANGE.max, low: range.min, high: range.max, ends: [degreeEnds.low, degreeEnds.high], onChange: (min, max) => setCategory(clampRange({ min, max })) })] }), _jsxs("fieldset", { className: "field", children: [_jsx("legend", { className: "field-label", style: { fontSize: 16 }, children: "What you offer" }), _jsx("span", { className: "field-hint", children: renameMode
                                    ? 'Tap an activity to rename it.'
                                    : "Tap to turn any off. Press and hold to rename one. Designs only use what's on here and a yes from your partner." }), _jsx("div", { className: "chips", children: items.map((a) => (_jsx(ActivityChip, { activity: a, pressed: isOffered(setup, a, studio), onTap: () => (renameMode ? onRename(a) : toggleActivity(a)), onHold: () => onRename(a) }, a.id))) }), _jsx("button", { type: "button", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, "aria-pressed": renameMode, onClick: () => setRenameMode((m) => !m), children: renameMode ? 'Done renaming' : 'Rename activities' })] }), items.some((a) => a.edge) && (_jsx("p", { className: "note", style: { margin: 0 }, children: "Edge play is never added to a design automatically and always needs explicit negotiation." })), setup.offerings.custom.some((a) => a.category === id) && (_jsxs("div", { className: "stack", style: { gap: 6 }, children: [_jsx("span", { className: "field-label", style: { fontSize: 16 }, children: "Your own" }), setup.offerings.custom
                                .filter((a) => a.category === id)
                                .map((a) => (_jsxs("div", { className: "person", children: [_jsx("span", { children: a.label }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => removeOwn(a), "aria-label": `Remove ${a.label}`, children: "Remove" })] }, a.id)))] })), _jsxs("div", { className: "field", children: [_jsx("label", { className: "field-label", style: { fontSize: 16 }, htmlFor: `add-${id}`, children: "Add your own" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { id: `add-${id}`, className: "input", maxLength: 60, value: adding, onChange: (e) => setAdding(e.target.value), onKeyDown: (e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addOwn();
                                            }
                                        }, style: { flex: 1 } }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: addOwn, disabled: !adding.trim(), children: "Add" })] })] })] }))] }));
}
/** A chip that toggles on tap and asks to rename on press and hold. */
function ActivityChip({ activity: a, pressed, onTap, onHold }) {
    const timer = useRef(undefined);
    const held = useRef(false);
    const start = useRef({ x: 0, y: 0 });
    const cancel = () => window.clearTimeout(timer.current);
    return (_jsxs("button", { type: "button", className: "chip", "aria-pressed": pressed, style: { WebkitTouchCallout: 'none', userSelect: 'none' }, onPointerDown: (e) => {
            held.current = false;
            start.current = { x: e.clientX, y: e.clientY };
            cancel();
            timer.current = window.setTimeout(() => {
                held.current = true;
                onHold();
            }, HOLD_MS);
        }, onPointerMove: (e) => {
            if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10)
                cancel();
        }, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel, onContextMenu: (e) => {
            // A long press on a phone, or a right click: rename instead of a menu.
            e.preventDefault();
            cancel();
            if (!held.current) {
                held.current = true;
                onHold();
            }
        }, onClick: () => {
            if (held.current) {
                held.current = false;
                return;
            }
            onTap();
        }, children: [a.label, a.edge ? ' (edge)' : '', a.negotiatedOnly ? ' (negotiated)' : ''] }));
}
function RenameSheet({ activity, onChange, onClose }) {
    const [name, setName] = useState(activity.label);
    const original = builtIn.find((b) => b.id === activity.id)?.label;
    const renamed = original !== undefined && original !== activity.label;
    function save(next) {
        const label = next.trim();
        if (!label)
            return;
        onChange((o) => {
            if (activity.custom)
                return { ...o, custom: o.custom.map((c) => (c.id === activity.id ? { ...c, label } : c)) };
            const { [activity.id]: _old, ...rest } = o.renames;
            return { ...o, renames: label === original ? rest : { ...rest, [activity.id]: label } };
        });
        onClose();
    }
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "rename-title", children: _jsxs("div", { className: "sheet", children: [_jsxs("h2", { id: "rename-title", children: ["Rename ", activity.label] }), _jsx("p", { style: { margin: 0 }, children: "Use the words that fit you and your partners. Ember uses your name for it from now on." }), _jsx(TextInput, { label: "Name", value: name, max: 60, onChange: setName }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: !name.trim(), onClick: () => save(name), children: "Save name" }), renamed && (_jsxs("button", { type: "button", className: "btn btn-outline btn-block", onClick: () => save(original), children: ["Back to \"", original, "\""] })), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: onClose, children: "Cancel" })] }) }));
}
