import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { AccountError, cardFor, listConnections } from '../../lib/account';
import { listShares, setShare } from '../../lib/intake';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { Segments } from './Bits';
/** What the Top sees at each level, in plain words. */
export function levelText(level, name) {
    switch (level) {
        case 'none':
            return `${name} sees only your scene name and pronouns. None of your answers, so Ember can't suggest anything to them, and anything they plan with you is flagged "Discussed together?".`;
        case 'essentials':
            return `${name} sees what keeps you safe: your signals and hand sign, every limit (your no and maybe answers and the limits you wrote), experience and how easily you speak up, injuries, health notes and allergies, triggers and what helps if you're overwhelmed, your emergency contact, honorifics, and the substance agreement. Not your desires or yes answers, so Ember can't suggest activities from them.`;
        case 'full':
            return `${name} sees everything in Essentials, plus your desires: Heat, Hold and Flow words and decoder answers, your desire map, every yes, maybe and no with how far you'd go, impact preferences and marks, words you like and don't, and your aftercare map and needs. Ember designs their scene options from your yes answers.`;
    }
}
const levels = [
    { id: 'none', label: 'Not shared' },
    { id: 'essentials', label: 'Essentials' },
    { id: 'full', label: 'Full' }
];
export function SharePanel({ only }) {
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [people, setPeople] = useState(null);
    const [shares, setShares] = useState({});
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!keys)
            return;
        Promise.all([listConnections(keys, cardFor(settings.identity)), listShares(keys)])
            .then(([conns, list]) => {
            setPeople(conns.filter((c) => c.status !== 'ended' && c.myRole !== 'top' && (!only || c.otherId === only)));
            setShares(Object.fromEntries(list.map((s) => [s.recipientId, s.scope])));
        })
            .catch(() => setPeople([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys, only]);
    if (!keys || people === null)
        return null;
    if (people.length === 0) {
        return only ? null : _jsx("p", { className: "note", children: "Once you connect with a Top, you can choose what they see here." });
    }
    async function change(otherId, level) {
        if (!keys)
            return;
        setBusy(otherId);
        setError('');
        try {
            await setShare(keys, settings.identity, otherId, level === 'none' ? null : level);
            setShares((s) => ({ ...s, [otherId]: level }));
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't update sharing. Please try again.");
        }
        finally {
            setBusy(null);
        }
    }
    return (_jsxs("div", { className: "stack", style: { gap: 14 }, children: [people.map((p) => (_jsxs("div", { "aria-busy": busy === p.otherId, children: [_jsx(Segments, { label: `What ${p.them?.name || 'this connection'} can see`, options: levels, value: shares[p.otherId] ?? 'none', onChange: (level) => void change(p.otherId, level) }), _jsx("p", { className: "setting-desc", style: { margin: '6px 0 0' }, children: levelText(shares[p.otherId] ?? 'none', p.them?.name || 'They') })] }, p.id))), _jsx("p", { className: "note", children: "Taking access away works right away, and anything you save afterward stays out of their reach." }), error && _jsx("p", { className: "note error", role: "alert", children: error })] }));
}
