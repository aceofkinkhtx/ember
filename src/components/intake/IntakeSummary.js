import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { aftercareMap, bodyAreas, decoderAnswers, desireMap, nearCenter, presenceQuestions, quadrantOf, shadeOf, wordGroups } from '../../content/intake';
import { activities, categories, experienceLevels, impactAreas, impactPositions, markOptions, speakUpLevels } from '../../data/activities';
import { limitsOf } from '../../lib/intake';
// Everything in an intake, the way the person it is shared with sees it.
// "Essentials only" shows just the first part.
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
function Block({ title, updated, children }) {
    return (_jsxs("section", { className: "card stack", style: { gap: 8 }, children: [_jsxs("div", { className: "person", children: [_jsx("h3", { className: "eyebrow", style: { margin: 0 }, children: title }), updated && _jsxs("span", { className: "note", children: ["Updated ", dateFmt.format(new Date(updated))] })] }), children] }));
}
function Row({ label, children }) {
    if (children === null || children === undefined || children === '' || (Array.isArray(children) && children.length === 0))
        return null;
    return (_jsxs("p", { style: { margin: 0 }, children: [_jsxs("strong", { children: [label, ":"] }), " ", children] }));
}
function dotText(map, dot) {
    if (!dot)
        return null;
    if (nearCenter(dot))
        return 'A little of everything';
    const q = quadrantOf(map, dot);
    return `${q.label}: ${shadeOf(map, dot)}`;
}
const nameOf = (list, id) => list.find((x) => x.id === id)?.label ?? null;
const join = (xs) => xs.filter(Boolean).join(', ');
/** The limit strip: no in red, maybe in amber. */
export function LimitStrip({ intake }) {
    const listed = limitsOf(intake);
    const own = intake.essentials.limits ?? { hard: '', soft: '' };
    const hard = [...listed.hard, own.hard.trim(), intake.detailed?.limits.hardExtra.trim() ?? ''].filter(Boolean);
    const soft = [...listed.soft, own.soft.trim()].filter(Boolean);
    if (!hard.length && !soft.length)
        return null;
    return (_jsxs("div", { className: "stack", style: { gap: 6 }, children: [hard.length > 0 && (_jsxs("p", { style: { margin: 0, padding: '8px 12px', borderRadius: 10, background: '#B3261E', color: '#fff' }, children: [_jsx("strong", { children: "No:" }), " ", join(hard)] })), soft.length > 0 && (_jsxs("p", { style: { margin: 0, padding: '8px 12px', borderRadius: 10, background: '#E8A317', color: '#1d1406' }, children: [_jsx("strong", { children: "Maybe:" }), " ", join(soft)] }))] }));
}
function hasLimits(intake) {
    const l = limitsOf(intake);
    const own = intake.essentials.limits ?? { hard: '', soft: '' };
    return Boolean(l.hard.length || l.soft.length || own.hard.trim() || own.soft.trim() || intake.detailed?.limits.hardExtra.trim());
}
export function IntakeSummary({ intake, full = true }) {
    const e = intake.essentials;
    const speak = speakUpLevels.find((s) => s.id === e.speakUp);
    const honor = join([...e.honorifics, e.honorificCustom.trim()]);
    const d = intake.detailed;
    const a = intake.aftercare;
    const all = [...activities, ...(d?.custom ?? [])];
    return (_jsxs("div", { className: "stack", style: { gap: 12 }, children: [_jsxs(Block, { title: "Signals", updated: intake.updated.essentials, children: [_jsxs("p", { style: { margin: 0 }, children: [_jsx("strong", { children: "Green:" }), " ", e.signals.green, " \u00B7 ", _jsx("strong", { children: "Yellow:" }), " ", e.signals.yellow, " \u00B7 ", _jsx("strong", { children: "Red:" }), " ", e.signals.red] }), _jsx(Row, { label: "Hand signal", children: e.signals.handSign }), _jsx(Row, { label: "Also", children: e.signals.custom })] }), _jsx(Block, { title: "Limits", children: hasLimits(intake) ? _jsx(LimitStrip, { intake: intake }) : _jsx("p", { className: "note", style: { margin: 0 }, children: "No limits listed yet. Ask before assuming anything." }) }), _jsxs(Block, { title: "Essentials", children: [_jsx(Row, { label: "Experience", children: nameOf(experienceLevels, e.experience) }), _jsx(Row, { label: "Speaking up", children: speak?.label }), speak?.selfAdvocacyFlag && (_jsx("p", { className: "note", style: { margin: 0 }, children: "Check in often and ask directly. Silence is not a yes." })), _jsx(Row, { label: "Call me", children: honor }), _jsx(Row, { label: "Body notes", children: join(e.body.areas.map((id) => nameOf(bodyAreas, id) ?? id)) }), _jsx(Row, { label: "Injuries and health", children: e.body.notes }), _jsx(Row, { label: "Allergies", children: e.body.allergies }), _jsx(Row, { label: "Triggers", children: join([...e.triggers.chips, e.triggers.notes]) }), _jsx(Row, { label: "If I'm overwhelmed", children: join([...e.overwhelm.chips, e.overwhelm.notes]) }), _jsx(Row, { label: "Emergency contact", children: e.emergency?.kind === '911'
                            ? 'Call 911'
                            : e.emergency
                                ? `${e.emergency.name}, ${e.emergency.phone}${e.emergency.aware === 'no' ? " (doesn't know about kink)" : e.emergency.aware === 'some' ? ' (knows a little about kink)' : ''}`
                                : null }), _jsx(Row, { label: "Substances", children: e.substanceAgreedAt ? 'Agrees to no play when noticeably intoxicated' : null }), _jsx(Row, { label: "Overriding a no", children: e.allowNoOverride.on ? 'Allowed after we talk' : 'Never. Every no is a hard block' })] }), !full && _jsx("p", { className: "note", children: "You can see essentials only." }), full && (intake.quick || intake.desireMap) && (_jsxs(Block, { title: "Desires", updated: intake.updated.quick ?? intake.updated.desireMap, children: [intake.quick &&
                        wordGroups.map((g) => {
                            const words = intake.quick.words[g.id].map((id) => g.words.find((w) => w.id === id)?.label ?? id);
                            const why = (intake.quick.decoder[g.id] ?? []).map((id) => nameOf(decoderAnswers, id) ?? id);
                            return (_jsxs(Row, { label: g.title, children: [join(words), why.length ? ` (for ${join(why).toLowerCase()})` : ''] }, g.id));
                        }), _jsx(Row, { label: "Desire map", children: dotText(desireMap, intake.desireMap) })] })), full && d && (_jsxs(Block, { title: "Activities", updated: intake.updated.detailed, children: [categories.map((c) => {
                        const yes = all.filter((x) => x.category === c.id && d.answers[x.id]?.choice === 'yes');
                        if (!yes.length)
                            return null;
                        return (_jsx(Row, { label: `Yes, ${c.label.toLowerCase()}`, children: join(yes.map((x) => `${x.label}${d.answers[x.id].intensity ? ` (${d.answers[x.id].intensity} of 5)` : ''}`)) }, c.id));
                    }), _jsx(Row, { label: "Impact areas", children: join(d.impact.areas.map((id) => nameOf(impactAreas, id) ?? id)) }), _jsx(Row, { label: "Positions", children: join(d.impact.positions.map((id) => nameOf(impactPositions, id) ?? id)) }), _jsx(Row, { label: "Feel", children: join(d.impact.feel) }), _jsx(Row, { label: "Marks", children: nameOf(markOptions, d.impact.marks) }), _jsx(Row, { label: "Words welcome", children: d.words.welcome }), _jsx(Row, { label: "Words off-limits", children: d.words.offLimits }), _jsx(Row, { label: "Don't touch", children: d.limits.noTouch })] })), full && intake.myBody && (intake.myBody.wordsWelcome || intake.myBody.wordsAvoid) && (_jsxs(Block, { title: "My body", children: [_jsx(Row, { label: "Words I like for my body", children: intake.myBody.wordsWelcome }), _jsx(Row, { label: "Words to avoid", children: intake.myBody.wordsAvoid })] })), full && a && (_jsxs(Block, { title: "Aftercare", updated: intake.updated.aftercare, children: [_jsx(Row, { label: "Right after", children: dotText(aftercareMap, a.map) }), _jsx(Row, { label: "The next day", children: dotText(aftercareMap, a.nextDay) }), _jsx(Row, { label: "Extras", children: join(a.extras) }), presenceQuestions.map((q) => (_jsx(Row, { label: q.label, children: a.presence[q.id] === 'yes' ? 'Yes' : a.presence[q.id] === 'ask' ? 'Ask me first' : a.presence[q.id] === 'no' ? 'No' : null }, q.id))), _jsx(Row, { label: "Curious about", children: a.curiosity })] }))] }));
}
