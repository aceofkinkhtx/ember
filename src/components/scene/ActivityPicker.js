import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { allTopActivities, available } from '../../content/topSetup';
import { categories } from '../../data/activities';
import { choiceOf, confirmationsFor } from '../../lib/scene/rules';
// Choose an activity for a scene. Yes items come first; the rest carry a flag:
// maybe (amber), not answered (gray), no (red, and only with the bottom's
// permission and a required question). Edge play and sex acts ask too.
export function ActivityTag({ ctx, activity }) {
    const choice = choiceOf(ctx, activity.id);
    // Maybe and unanswered only matter for a partner's answers.
    const partner = (ctx.intakeOf ?? 'partner') === 'partner';
    return (_jsxs(_Fragment, { children: [partner && choice === 'maybe' && _jsx("span", { className: "tag tag-amber", children: "Maybe" }), partner && choice === null && _jsx("span", { className: "tag tag-gray", children: "Not answered" }), choice === 'no' && _jsx("span", { className: "tag tag-red", children: "No" }), activity.edge && _jsx("span", { className: "tag tag-red", children: "Edge" }), activity.negotiatedOnly && _jsx("span", { className: "tag tag-amber", children: "Negotiated" })] }));
}
/** Everything a designer could add, with the bottom's own additions. */
export function choosable(ctx) {
    const mine = allTopActivities(ctx.top.offerings).filter((a) => available(a, ctx.top.settings, true));
    return [...mine, ...(ctx.intake?.detailed?.custom ?? [])];
}
/**
 * Runs the checks for one activity: refuses with a reason, asks each required
 * question, then hands back the dated overrides to record.
 */
export function useAddActivity(ctx, onAdd) {
    const [asking, setAsking] = useState(null);
    const [refused, setRefused] = useState('');
    function start(a) {
        setRefused('');
        const check = confirmationsFor(ctx, a);
        if ('blocked' in check) {
            setRefused(check.blocked);
            return;
        }
        if (!check.confirm.length)
            onAdd(a, []);
        else
            setAsking({ activity: a, queue: check.confirm, done: [] });
    }
    function answer(yes) {
        if (!asking)
            return;
        if (!yes) {
            setAsking(null);
            return;
        }
        const [first, ...rest] = asking.queue;
        const done = [...asking.done, { activityId: asking.activity.id, kind: first.kind, confirmedAt: new Date().toISOString() }];
        if (rest.length)
            setAsking({ ...asking, queue: rest, done });
        else {
            setAsking(null);
            onAdd(asking.activity, done);
        }
    }
    const sheet = asking && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-title", children: _jsxs("div", { className: "sheet", children: [_jsx("span", { className: "tag tag-red", style: { alignSelf: 'flex-start' }, children: asking.queue[0].kind === 'no' ? 'They said no' : asking.queue[0].kind === 'edge' ? 'Edge play' : 'Sex act' }), _jsx("h2", { id: "confirm-title", style: { margin: 0 }, children: asking.queue[0].question }), _jsx("p", { className: "note", style: { margin: 0 }, children: "Your answer is saved with today's date in this scene's record. The flag stays visible on the beat and in the live guide." }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => answer(true), children: "Yes, we agreed" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => answer(false), children: "No, leave it out" })] }) }));
    return { start, sheet, refused, clearRefused: () => setRefused('') };
}
/** Activities to add: the categories first, then the one you open. */
export function ActivityList({ ctx, exclude, onChoose }) {
    const [open, setOpen] = useState(null);
    const list = choosable(ctx).filter((a) => !exclude.includes(a.id));
    return (_jsx("div", { className: "stack", style: { gap: 8 }, children: categories.map((c) => {
            const items = list.filter((a) => a.category === c.id);
            if (!items.length)
                return null;
            return (_jsxs("div", { className: "stack", style: { gap: 8 }, children: [_jsxs("button", { type: "button", className: "choice", "aria-expanded": open === c.id, onClick: () => setOpen(open === c.id ? null : c.id), style: { justifyContent: 'space-between' }, children: [_jsx("span", { className: "choice-word", children: c.label }), _jsxs("span", { className: "note", children: [items.length, " ", open === c.id ? '▴' : '▾'] })] }), open === c.id && (_jsx("div", { className: "chips", children: items.map((a) => (_jsxs("button", { type: "button", className: "chip", onClick: () => onChoose(a), style: { display: 'inline-flex', gap: 6, alignItems: 'center' }, children: [a.label, " ", _jsx(ActivityTag, { ctx: ctx, activity: a })] }, a.id))) }))] }, c.id));
        }) }));
}
