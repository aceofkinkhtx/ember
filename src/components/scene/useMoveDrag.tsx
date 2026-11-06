import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

// Drag an item by its handle into any list of the same kind on the screen:
// a step into another beat, a beat into another section. The arrow keys move
// it too, one place at a time, crossing into the next list at either end.
// The screen scrolls by itself when the finger nears its top or bottom edge.

export interface DropAt {
  container: string;
  index: number;
}

interface Measured {
  id: string;
  top: number;
  bottom: number;
  items: { id: string; top: number; bottom: number; mid: number }[];
}

interface Live {
  id: string;
  from: DropAt;
  startY: number;
  scroll0: number;
  scroller: HTMLElement;
  lists: Measured[];
  lastY: number;
}

const EDGE = 70;

export function useMoveDrag(kind: string, onDrop: (id: string, to: DropAt) => void) {
  const live = useRef<Live | null>(null);
  const frame = useRef<number | undefined>(undefined);
  const [drag, setDrag] = useState<{ id: string; dy: number; to: DropAt; line: { top: number; left: number; width: number } } | null>(null);

  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  /** Every list of this kind, measured in the scroller's content coordinates. */
  function measure(scroller: HTMLElement): Measured[] {
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    return [...document.querySelectorAll<HTMLElement>(`[data-drop="${kind}"]`)]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const items = [...el.querySelectorAll<HTMLElement>(`[data-drag="${kind}"]`)].map((it) => {
          const ir = it.getBoundingClientRect();
          return { id: it.dataset.id ?? '', top: ir.top - base, bottom: ir.bottom - base, mid: (ir.top + ir.bottom) / 2 - base };
        });
        return { id: el.dataset.container ?? '', top: r.top - base, bottom: r.bottom - base, items };
      })
      .filter((l) => l.bottom - l.top > 4);
  }

  function locate(s: Live, clientY: number) {
    const base = s.scroller.getBoundingClientRect().top - s.scroller.scrollTop;
    const y = clientY - base;
    const list =
      s.lists.find((l) => y >= l.top && y <= l.bottom) ??
      s.lists.reduce((best, l) => (Math.min(Math.abs(y - l.top), Math.abs(y - l.bottom)) < Math.min(Math.abs(y - best.top), Math.abs(y - best.bottom)) ? l : best), s.lists[0]);
    const others = list.items.filter((it) => it.id !== s.id);
    const index = others.filter((it) => it.mid < y).length;
    const lineY = index < others.length ? others[index].top - 4 : others.length ? others[others.length - 1].bottom + 4 : list.top + 6;
    const box = document.querySelector<HTMLElement>(`[data-drop="${kind}"][data-container="${list.id}"]`)?.getBoundingClientRect();
    return {
      to: { container: list.id, index },
      line: { top: lineY + base, left: box?.left ?? 0, width: box?.width ?? 0 },
      dy: y - (s.startY - s.scroller.getBoundingClientRect().top + s.scroll0)
    };
  }

  function show() {
    const s = live.current;
    if (s) setDrag({ id: s.id, ...locate(s, s.lastY) });
  }

  /** Scrolls while the finger rests near an edge. */
  function edgeScroll() {
    const s = live.current;
    if (!s) return;
    const r = s.scroller.getBoundingClientRect();
    // Anything pinned at the top (the scene map) counts as the edge.
    const top = Math.max(r.top, s.scroller.querySelector('.scene-map')?.getBoundingClientRect().bottom ?? r.top);
    const speed = s.lastY < top + EDGE ? -Math.ceil((top + EDGE - s.lastY) / 6) : s.lastY > r.bottom - EDGE ? Math.ceil((s.lastY - (r.bottom - EDGE)) / 6) : 0;
    if (speed) {
      s.scroller.scrollTop += speed;
      show();
    }
    frame.current = requestAnimationFrame(edgeScroll);
  }

  function end(drop: boolean) {
    cancelAnimationFrame(frame.current ?? 0);
    const s = live.current;
    live.current = null;
    if (s && drop) {
      const { to } = locate(s, s.lastY);
      if (to.container !== s.from.container || to.index !== s.from.index) onDrop(s.id, to);
    }
    setDrag(null);
  }

  /** Where the item sits now, from the page itself. */
  function position(id: string): { lists: { id: string; ids: string[] }[]; at: number; index: number } | null {
    const lists = [...document.querySelectorAll<HTMLElement>(`[data-drop="${kind}"]`)]
      .filter((el) => el.getBoundingClientRect().height > 4)
      .map((el) => ({ id: el.dataset.container ?? '', ids: [...el.querySelectorAll<HTMLElement>(`[data-drag="${kind}"]`)].map((it) => it.dataset.id ?? '') }));
    const at = lists.findIndex((l) => l.ids.includes(id));
    return at < 0 ? null : { lists, at, index: lists[at].ids.indexOf(id) };
  }

  const handle = (id: string, name: string) => ({
    'aria-label': `Move ${name}. Drag, or use the up and down arrow keys.`,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const scroller = (e.currentTarget.closest('.screen') as HTMLElement | null) ?? document.documentElement;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const lists = measure(scroller);
      const from = lists.findIndex((l) => l.items.some((it) => it.id === id));
      if (from < 0) return;
      live.current = {
        id,
        from: { container: lists[from].id, index: lists[from].items.findIndex((it) => it.id === id) },
        startY: e.clientY,
        scroll0: scroller.scrollTop,
        scroller,
        lists,
        lastY: e.clientY
      };
      show();
      frame.current = requestAnimationFrame(edgeScroll);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (live.current?.id !== id) return;
      live.current.lastY = e.clientY;
      show();
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      e.stopPropagation();
      if (live.current?.id === id) end(true);
    },
    onPointerCancel: () => end(false),
    onClick: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const p = position(id);
      if (!p) return;
      e.preventDefault();
      const here = p.lists[p.at];
      if (e.key === 'ArrowUp') {
        if (p.index > 0) onDrop(id, { container: here.id, index: p.index - 1 });
        else if (p.at > 0) onDrop(id, { container: p.lists[p.at - 1].id, index: p.lists[p.at - 1].ids.length });
      } else if (p.index < here.ids.length - 1) onDrop(id, { container: here.id, index: p.index + 1 });
      else if (p.at < p.lists.length - 1) onDrop(id, { container: p.lists[p.at + 1].id, index: 0 });
      // Keep focus on the handle after the item moves.
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${kind}"][data-id="${id}"] .drag-handle`)?.focus());
    }
  });

  const container = (id: string) => ({ 'data-drop': kind, 'data-container': id });

  const item = (id: string): { 'data-drag': string; 'data-id': string; className?: string; style?: CSSProperties } => ({
    'data-drag': kind,
    'data-id': id,
    className: drag?.id === id ? 'dragging' : undefined,
    style: drag?.id === id ? { transform: `translateY(${drag.dy}px)` } : undefined
  });

  const overlay = drag ? <div className="drop-line" aria-hidden="true" style={{ top: drag.line.top, left: drag.line.left, width: drag.line.width }} /> : null;

  return { handle, container, item, overlay, dragging: drag ? { id: drag.id, to: drag.to } : null };
}
