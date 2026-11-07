import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ToyGrid } from '../components/toys/ToyCard';
import { tabLabel } from '../content/copy';
import { feelOptions, listMyToys, loadToyRing, playTypes } from '../lib/toys';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
// T1: the toy directory. Anyone can keep one; Tops have it as a tab, and
// bottoms reach it from their profile.
export function Toys() {
    const { settings } = useSettings();
    const { keys, status } = useAccount();
    const navigate = useNavigate();
    const [toys, setToys] = useState(null);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState([]);
    const gens = useMemo(() => loadToyRing()?.gens ?? [], [toys]);
    useEffect(() => {
        if (!keys)
            return;
        listMyToys(keys)
            .then(setToys)
            .catch(() => {
            setToys([]);
            setError("Ember couldn't load your gear. Check your connection and try again.");
        });
    }, [keys]);
    const title = settings.activeRole === 'top' ? tabLabel('toys', settings.discreet) : settings.discreet ? 'My items' : 'My gear';
    if (status !== 'signed-in') {
        return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: title }), _jsxs("div", { className: "card stack", children: [_jsx("p", { style: { margin: 0 }, children: "Sign in to keep your gear. They're locked on your phone before they're saved, photos too." }), _jsx(Link, { to: "/connections", className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Sign in" })] })] }));
    }
    const options = [...feelOptions, ...playTypes];
    const shown = (toys ?? []).filter((t) => filters.every((f) => t.feel.includes(f) || t.types.includes(f)));
    return (_jsxs("main", { className: "screen", children: [_jsxs("div", { className: "person", children: [_jsx("h1", { style: { margin: 0 }, children: title }), _jsx(Link, { to: "/toys/new", className: "btn btn-primary", children: "Add" })] }), toys === null ? (_jsx("p", { className: "note", children: "Loading..." })) : toys.length === 0 ? (_jsxs("div", { className: "card stack", children: [_jsx("div", { className: "card-title", children: "Add your first piece of gear" }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: "A photo and three taps: how it feels, what kind of play, and a name. You choose who sees your collection, connection by connection." }), _jsx(Link, { to: "/toys/new", className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: "Add gear" })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "chips", role: "group", "aria-label": "Filter", children: options.map((o) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": filters.includes(o.id), onClick: () => setFilters((f) => (f.includes(o.id) ? f.filter((x) => x !== o.id) : [...f, o.id])), children: o.label }, o.id))) }), shown.length ? (_jsx(ToyGrid, { toys: shown, gens: gens, onOpen: (t) => navigate(`/toys/${t.id}`) })) : (_jsx("p", { className: "note", children: "Nothing matches those filters." })), _jsx("p", { className: "note", children: "Share your collection with a connection from their page in Connections. You can also keep any item out of scenes with one person." })] })), error && _jsx("p", { className: "note error", role: "alert", children: error })] }));
}
