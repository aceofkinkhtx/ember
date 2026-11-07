import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chips, TextArea, TextInput } from '../components/intake/Bits';
import { ToyPhoto } from '../components/toys/ToyCard';
import { AccountError, cardFor, listConnections } from '../lib/account';
import { shrinkPhoto } from '../lib/photo';
import { deleteToy, emptyToy, feelOptions, listMyToys, listOptOuts, loadToyRing, playTypes, saveToy, setOptOut } from '../lib/toys';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { displayName } from './Connections';
// T2: add or edit a toy. A photo, then three taps (feel, play type, name),
// notes, and which connections it stays out of scenes with.
export function ToyEdit() {
    const { id } = useParams();
    const isNew = !id || id === 'new';
    const navigate = useNavigate();
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [toy, setToy] = useState(isNew ? null : undefined);
    const [details, setDetails] = useState(emptyToy());
    // undefined keeps the current photo, null removes it.
    const [photo, setPhoto] = useState(undefined);
    const [preview, setPreview] = useState(null);
    const [people, setPeople] = useState([]);
    const [optedOut, setOptedOut] = useState([]);
    const [optedOutBefore, setOptedOutBefore] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const file = useRef(null);
    const gens = useMemo(() => loadToyRing()?.gens ?? [], [toy]);
    useEffect(() => {
        if (!keys)
            return;
        listConnections(keys, cardFor(settings.identity))
            .then((all) => setPeople(all.filter((c) => c.status !== 'ended')))
            .catch(() => setPeople([]));
        if (isNew)
            return;
        Promise.all([listMyToys(keys), listOptOuts()])
            .then(([toys, outs]) => {
            const found = toys.find((t) => t.id === id) ?? null;
            setToy(found);
            if (found)
                setDetails(found);
            const mine = outs.filter((o) => o.toyId === id).map((o) => o.connectionId);
            setOptedOut(mine);
            setOptedOutBefore(mine);
        })
            .catch(() => setToy(null));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys, id]);
    useEffect(() => () => {
        if (preview)
            URL.revokeObjectURL(preview);
    }, [preview]);
    async function pickPhoto(f) {
        if (!f)
            return;
        setError('');
        try {
            const bytes = await shrinkPhoto(f);
            setPhoto(bytes);
            setPreview(URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })));
        }
        catch {
            setError("Ember couldn't read that photo. Try another.");
        }
    }
    async function save() {
        if (!keys)
            return;
        if (!details.name.trim()) {
            setError('Give it a name first.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const saved = await saveToy(keys, { id: toy?.id, details }, photo);
            for (const c of people) {
                const now = optedOut.includes(c.id);
                if (now !== optedOutBefore.includes(c.id))
                    await setOptOut(c.id, saved.id, now);
            }
            navigate('/toys', { replace: true });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't save that. Please try again.");
            setBusy(false);
        }
    }
    async function remove() {
        if (!keys || !toy)
            return;
        setBusy(true);
        try {
            await deleteToy(keys, toy);
            navigate('/toys', { replace: true });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't delete that.");
            setBusy(false);
            setConfirmDelete(false);
        }
    }
    if (toy === undefined) {
        return (_jsx("main", { className: "screen", children: _jsx("p", { className: "note", children: "Loading..." }) }));
    }
    if (!isNew && toy === null) {
        return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/toys", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Back" }), _jsx("p", { className: "card", children: "That item isn't available." })] }));
    }
    const hasPhoto = photo ? true : photo === null ? false : Boolean(toy && toy.photoGen !== null);
    return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/toys", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Back" }), _jsx("h1", { children: isNew ? 'Add gear' : details.name || 'Edit gear' }), _jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Photo", children: [_jsx("div", { style: { width: 160, alignSelf: 'center' }, children: preview ? (_jsx("img", { src: preview, alt: "New photo", style: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 } })) : toy && hasPhoto ? (_jsx(ToyPhoto, { toy: toy, gens: gens })) : (_jsx("div", { className: "note", style: { width: '100%', aspectRatio: '1', borderRadius: 12, background: 'var(--line)', display: 'grid', placeItems: 'center' }, children: "No photo" })) }), _jsx("input", { ref: file, type: "file", accept: "image/*", capture: "environment", className: "sr-only", "aria-label": "Photo", tabIndex: -1, onChange: (e) => {
                            void pickPhoto(e.target.files?.[0]);
                            e.target.value = '';
                        } }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => file.current?.click(), children: hasPhoto ? 'New photo' : 'Take or choose a photo' }), hasPhoto && (_jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => {
                                    setPhoto(null);
                                    setPreview(null);
                                }, children: "Remove photo" }))] }), _jsx("p", { className: "note", style: { margin: 0, textAlign: 'center' }, children: "Photos are made smaller, cleared of location and camera details, and locked before they leave your phone." })] }), _jsxs("section", { className: "card stack", style: { gap: 16 }, children: [_jsx(Chips, { legend: "1. How it feels", options: feelOptions, value: details.feel, onChange: (feel) => setDetails((d) => ({ ...d, feel: feel })) }), _jsx(Chips, { legend: "2. Kind of play", options: playTypes, value: details.types, onChange: (types) => setDetails((d) => ({ ...d, types: types })) }), _jsx(TextInput, { label: "3. Name", value: details.name, max: 60, onChange: (name) => setDetails((d) => ({ ...d, name })) }), _jsx(TextArea, { label: "Notes", hint: "Anything worth remembering: size, material, cleaning, how it lands.", value: details.notes, rows: 3, max: 1000, onChange: (notes) => setDetails((d) => ({ ...d, notes })) })] }), people.length > 0 && (_jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": "Keep out of scenes with", children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Keep out of scenes with" }), _jsx("span", { className: "field-hint", children: "It won't be suggested or used in scenes with them, and it's hidden from them if you share your gear." }), _jsxs("select", { className: "input", value: "", disabled: people.every((c) => optedOut.includes(c.id)), onChange: (e) => e.target.value && setOptedOut((o) => [...o, e.target.value]), children: [_jsx("option", { value: "", children: people.every((c) => optedOut.includes(c.id)) ? 'Everyone is chosen' : 'Choose someone' }), people
                                        .filter((c) => !optedOut.includes(c.id))
                                        .map((c) => (_jsx("option", { value: c.id, children: displayName(c) }, c.id)))] })] }), people
                        .filter((c) => optedOut.includes(c.id))
                        .map((c) => (_jsxs("div", { className: "person", children: [_jsx("span", { children: displayName(c) }), _jsx("button", { type: "button", className: "btn btn-quiet", "aria-label": `Let ${displayName(c)} see this again`, onClick: () => setOptedOut((o) => o.filter((x) => x !== c.id)), children: "Remove" })] }, c.id)))] })), error && (_jsx("p", { className: "note error", role: "alert", children: error })), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy, onClick: save, children: busy ? 'Saving...' : 'Save' }), !isNew && (_jsx("button", { type: "button", className: "btn btn-outline btn-block", disabled: busy, onClick: () => setConfirmDelete(true), children: "Delete" })), confirmDelete && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "toy-delete-title", children: _jsxs("div", { className: "sheet", children: [_jsxs("h2", { id: "toy-delete-title", children: ["Delete ", details.name || 'this item', "?"] }), _jsx("p", { children: "It's removed from your collection and from anyone you share with. This can't be undone." }), _jsx("button", { type: "button", className: "btn btn-danger btn-block", disabled: busy, onClick: remove, children: "Delete" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => setConfirmDelete(false), children: "Cancel" })] }) }))] }));
}
