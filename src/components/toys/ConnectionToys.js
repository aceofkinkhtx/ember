import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountError } from '../../lib/account';
import { listMyToys, listOptOuts, listToyShares, readTheirToys, setToyShare, theyShareToys } from '../../lib/toys';
import { useAccount } from '../../state/account';
import { SettingSwitch } from '../Switch';
import { ToyGrid } from './ToyCard';
// Toys on a connection's page: share your collection with this person, see
// which of your toys stay out of scenes with them, and look at theirs when
// you ask ("Show their gear"), never up front.
export function ConnectionToys({ connection, name }) {
    const { keys } = useAccount();
    const [sharing, setSharing] = useState(null);
    const [mine, setMine] = useState([]);
    const [optOuts, setOptOuts] = useState([]);
    const [theyShare, setTheyShare] = useState(false);
    const [theirs, setTheirs] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!keys)
            return;
        Promise.all([listToyShares(keys), listMyToys(keys), listOptOuts(), theyShareToys(keys, connection.otherId)])
            .then(([shares, toys, outs, shared]) => {
            setSharing(shares.includes(connection.otherId));
            setMine(toys);
            setOptOuts(outs.filter((o) => o.connectionId === connection.id).map((o) => o.toyId));
            setTheyShare(shared);
        })
            .catch(() => setSharing(false));
    }, [keys, connection.id, connection.otherId]);
    async function share(on) {
        if (!keys)
            return;
        setBusy(true);
        setError('');
        try {
            await setToyShare(keys, connection.otherId, on);
            setSharing(on);
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    async function showTheirs() {
        if (!keys)
            return;
        setError('');
        setTheirs(undefined);
        try {
            const got = await readTheirToys(keys, connection.otherId);
            // Toys they keep out of scenes with you don't show.
            setTheirs(got && { ...got, toys: got.toys.filter((t) => !optOuts.includes(t.id)) });
        }
        catch {
            setTheirs(null);
            setError("Ember couldn't load their gear. Please try again.");
        }
    }
    if (sharing === null)
        return null;
    const kept = mine.filter((t) => optOuts.includes(t.id));
    return (_jsxs("section", { className: "card stack", "aria-label": "Gear", children: [_jsx("div", { className: "eyebrow", children: "Gear" }), mine.length ? (_jsx("div", { "aria-busy": busy, children: _jsx(SettingSwitch, { label: `Share my gear with ${name}`, description: sharing
                        ? 'They can look through your collection when they design a scene with you.'
                        : 'Off. Your collection stays private to you.', checked: sharing, onChange: (on) => void share(on) }) })) : (_jsxs("p", { className: "note", style: { margin: 0 }, children: ["You haven't added any gear. ", _jsx(Link, { to: "/toys/new", children: "Add one" }), " to share it with ", name, "."] })), kept.length > 0 && (_jsxs("p", { className: "note", style: { margin: 0 }, children: ["Kept out of scenes with ", name, ": ", kept.map((t) => t.name).join(', '), ". Change this on each item in ", _jsx(Link, { to: "/toys", children: "your gear" }), "."] })), theyShare ? (theirs === undefined ? (_jsx("button", { type: "button", className: "btn btn-outline", style: { alignSelf: 'flex-start' }, onClick: () => void showTheirs(), children: "Show their gear" })) : theirs && theirs.toys.length ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field-label", style: { fontSize: 16 }, children: [name, "'s gear"] }), _jsx(ToyGrid, { toys: theirs.toys, gens: theirs.gens })] })) : (_jsxs("p", { className: "note", style: { margin: 0 }, children: [name, " hasn't added any gear yet."] }))) : (_jsxs("p", { className: "note", style: { margin: 0 }, children: [name, " hasn't shared their gear with you."] })), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] }));
}
