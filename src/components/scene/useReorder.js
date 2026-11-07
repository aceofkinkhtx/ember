import { useRef, useState } from 'react';
// Drag to reorder a vertical list by its handle, with a finger or a mouse.
// The arrow keys move the item too, so it works without dragging.
export function useReorder(count, onMove) {
    const items = useRef([]);
    const start = useRef(null);
    const [drag, setDrag] = useState(null);
    function targetFor(from, dy) {
        const s = start.current;
        const center = s.mids[from] + dy;
        return s.mids.filter((m, i) => i !== from && m < center).length;
    }
    const handle = (i, name) => ({
        'aria-label': `Move ${name}. Drag, or use the up and down arrow keys.`,
        onPointerDown: (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            const mids = items.current.slice(0, count).map((el) => {
                const r = el?.getBoundingClientRect();
                return r ? r.top + r.height / 2 : 0;
            });
            start.current = { y: e.clientY, mids, from: i };
            setDrag({ from: i, dy: 0, to: i });
        },
        onPointerMove: (e) => {
            if (!start.current || start.current.from !== i)
                return;
            const dy = e.clientY - start.current.y;
            setDrag({ from: i, dy, to: targetFor(i, dy) });
        },
        onPointerUp: (e) => {
            e.stopPropagation();
            if (drag && drag.to !== drag.from)
                onMove(drag.from, drag.to);
            start.current = null;
            setDrag(null);
        },
        onPointerCancel: () => {
            start.current = null;
            setDrag(null);
        },
        onClick: (e) => e.stopPropagation(),
        onKeyDown: (e) => {
            if (e.key === 'ArrowUp' && i > 0) {
                e.preventDefault();
                onMove(i, i - 1);
            }
            else if (e.key === 'ArrowDown' && i < count - 1) {
                e.preventDefault();
                onMove(i, i + 1);
            }
        }
    });
    const item = (i) => ({
        ref: (el) => {
            items.current[i] = el;
        },
        className: drag?.from === i ? 'dragging' : undefined,
        style: drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : drag && i === drag.to && drag.to !== drag.from ? { outline: '2px dashed var(--accent-strong)', outlineOffset: 2 } : undefined
    });
    return { handle, item, dragging: drag !== null };
}
/** Moves one item in a list. */
export function moved(list, from, to) {
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
}
