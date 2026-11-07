import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { feelOptions, photoUrl, playTypes } from '../../lib/toys';
// One toy in a grid: its photo (unlocked on this phone) or its first letter.
export function toyTags(toy) {
    return [...feelOptions.filter((f) => toy.feel.includes(f.id)), ...playTypes.filter((t) => toy.types.includes(t.id))]
        .map((x) => x.label)
        .join(', ');
}
export function ToyPhoto({ toy, gens, size = '100%' }) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        let live = true;
        setUrl(null);
        photoUrl(toy, gens)
            .then((u) => live && setUrl(u))
            .catch(() => undefined);
        return () => {
            live = false;
        };
    }, [toy.id, toy.photoGen, toy.updatedAt, gens]);
    return (_jsx("div", { "aria-hidden": "true", style: {
            width: size,
            aspectRatio: '1',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--line)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--muted)'
        }, children: url ? _jsx("img", { src: url, alt: "", style: { width: '100%', height: '100%', objectFit: 'cover' } }) : (toy.name[0] ?? '?').toUpperCase() }));
}
export function ToyGrid({ toys, gens, onOpen }) {
    return (_jsx("ul", { style: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }, children: toys.map((toy) => {
            const body = (_jsxs(_Fragment, { children: [_jsx(ToyPhoto, { toy: toy, gens: gens }), _jsx("span", { style: { fontWeight: 600, display: 'block', marginTop: 6 }, children: toy.name || 'Unnamed item' }), _jsx("span", { className: "note", style: { display: 'block' }, children: toyTags(toy) })] }));
            return (_jsx("li", { children: onOpen ? (_jsx("button", { type: "button", onClick: () => onOpen(toy), style: { all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }, "aria-label": `${toy.name || 'Unnamed item'}${toyTags(toy) ? `, ${toyTags(toy)}` : ''}`, children: body })) : (body) }, toy.id));
        }) }));
}
