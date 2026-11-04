import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { nearCenter, quadrantOf, shadeOf, type Dot, type MapSpec } from '../../content/intake';

// Drag one dot onto a two-axis map. Arrow keys move it too. The wording
// changes with how far into its quadrant the dot sits.

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

export function MapPicker({ map, value, onChange, label }: { map: MapSpec; value: Dot | null; onChange: (dot: Dot) => void; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function place(e: PointerEvent<HTMLDivElement>) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const x = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
    const y = clamp(1 - ((e.clientY - r.top) / r.height) * 2);
    onChange({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  }

  function keys(e: KeyboardEvent<HTMLDivElement>) {
    const d = value ?? { x: 0, y: 0 };
    const step = 0.1;
    const moves: Record<string, Dot> = {
      ArrowLeft: { x: clamp(d.x - step), y: d.y },
      ArrowRight: { x: clamp(d.x + step), y: d.y },
      ArrowUp: { x: d.x, y: clamp(d.y + step) },
      ArrowDown: { x: d.x, y: clamp(d.y - step) }
    };
    const next = moves[e.key];
    if (next) {
      e.preventDefault();
      onChange({ x: Math.round(next.x * 100) / 100, y: Math.round(next.y * 100) / 100 });
    }
  }

  const q = value ? quadrantOf(map, value) : null;
  const [tl, tr, bl, br] = map.quadrants;

  return (
    <div className="stack" style={{ gap: 12 }}>
      {label && <span className="field-label">{label}</span>}
      <div className="note" style={{ textAlign: 'center' }}>
        {map.y[1]}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="note" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {map.x[0]}
        </span>
        <div
          ref={box}
          role="slider"
          tabIndex={0}
          aria-label={`${map.title}: drag the dot. Left is ${map.x[0]}, right is ${map.x[1]}, down is ${map.y[0]}, up is ${map.y[1]}.`}
          aria-valuetext={q ? (nearCenter(value!) ? 'A little of everything' : `${q.label}: ${shadeOf(map, value!)}`) : 'No dot placed yet'}
          onKeyDown={keys}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            place(e);
          }}
          onPointerMove={(e) => dragging.current && place(e)}
          onPointerUp={() => (dragging.current = false)}
          style={{
            position: 'relative',
            flex: 1,
            aspectRatio: '1',
            borderRadius: 16,
            border: '2px solid var(--line)',
            background:
              'linear-gradient(var(--line), var(--line)) center / 2px 100% no-repeat, linear-gradient(var(--line), var(--line)) center / 100% 2px no-repeat, linear-gradient(90deg, transparent calc(25% - 0.5px), var(--surface-sunk) calc(25% - 0.5px) calc(25% + 0.5px), transparent calc(25% + 0.5px) calc(75% - 0.5px), var(--surface-sunk) calc(75% - 0.5px) calc(75% + 0.5px), transparent calc(75% + 0.5px)), linear-gradient(transparent calc(25% - 0.5px), var(--surface-sunk) calc(25% - 0.5px) calc(25% + 0.5px), transparent calc(25% + 0.5px) calc(75% - 0.5px), var(--surface-sunk) calc(75% - 0.5px) calc(75% + 0.5px), transparent calc(75% + 0.5px)), var(--surface)',
            touchAction: 'none',
            cursor: 'crosshair',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr'
          }}
        >
          {[tl, tr, bl, br].map((w) => (
            <span
              key={w.id}
              className="note"
              style={{ display: 'grid', placeItems: 'center', fontWeight: q?.id === w.id ? 700 : 500, opacity: q && q.id !== w.id ? 0.5 : 1 }}
            >
              {w.label}
            </span>
          ))}
          {value && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${((value.x + 1) / 2) * 100}%`,
                top: `${((1 - value.y) / 2) * 100}%`,
                width: 26,
                height: 26,
                marginLeft: -13,
                marginTop: -13,
                borderRadius: '50%',
                background: 'var(--ember)',
                boxShadow: '0 0 0 4px rgba(255,255,255,0.8), 0 0 16px rgba(255,90,8,0.7)'
              }}
            />
          )}
        </div>
        <span className="note" style={{ writingMode: 'vertical-rl' }}>
          {map.x[1]}
        </span>
      </div>
      <div className="note" style={{ textAlign: 'center' }}>
        {map.y[0]}
      </div>
      <p className="card" aria-live="polite" style={{ margin: 0 }}>
        {q ? (
          <span>
            <strong>{nearCenter(value!) ? 'A little of everything' : q.label}</strong>
            {nearCenter(value!) ? '. Near the middle, every corner gets a share.' : `. ${shadeOf(map, value!)}`}
          </span>
        ) : (
          <span>Tap or drag to place your dot.</span>
        )}
      </p>
    </div>
  );
}
