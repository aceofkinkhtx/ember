import { bodyAreas } from '../../content/intake';
import { toggle } from './Bits';

// A simple front and back outline. Tap a spot on the figure or its name.

const spots: Record<string, { x: number; y: number; r: number }> = {
  head: { x: 50, y: 14, r: 9 },
  neck: { x: 50, y: 27, r: 5 },
  shoulders: { x: 50, y: 34, r: 8 },
  chest: { x: 50, y: 44, r: 9 },
  arms: { x: 26, y: 52, r: 7 },
  'wrists-hands': { x: 20, y: 76, r: 7 },
  belly: { x: 50, y: 60, r: 8 },
  hips: { x: 50, y: 72, r: 8 },
  genitals: { x: 50, y: 81, r: 6 },
  knees: { x: 42, y: 112, r: 6 },
  'ankles-feet': { x: 42, y: 140, r: 7 },
  'upper-back': { x: 150, y: 42, r: 10 },
  'lower-back': { x: 150, y: 62, r: 9 },
  butt: { x: 150, y: 78, r: 9 },
  thighs: { x: 142, y: 96, r: 8 },
  calves: { x: 142, y: 124, r: 7 }
};

function Figure({ cx }: { cx: number }) {
  return (
    <g fill="var(--surface-sunk)" stroke="var(--line)" strokeWidth="1.5">
      <circle cx={cx} cy={14} r={10} />
      <rect x={cx - 14} y={28} width={28} height={52} rx={10} />
      <rect x={cx - 26} y={32} width={9} height={46} rx={4} />
      <rect x={cx + 17} y={32} width={9} height={46} rx={4} />
      <rect x={cx - 13} y={80} width={11} height={68} rx={5} />
      <rect x={cx + 2} y={80} width={11} height={68} rx={5} />
    </g>
  );
}

export function BodyMap({ value, onChange, legend, hint }: { value: string[]; onChange: (next: string[]) => void; legend: string; hint?: string }) {
  return (
    <fieldset className="field">
      <legend className="field-label">{legend}</legend>
      {hint && <span className="field-hint">{hint}</span>}
      <svg viewBox="0 0 200 156" style={{ width: '100%', maxWidth: 320, alignSelf: 'center' }} role="img" aria-label="Body outline, front and back">
        <Figure cx={50} />
        <Figure cx={150} />
        <text x={50} y={155} textAnchor="middle" fontSize="7" fill="var(--text-muted)">
          Front
        </text>
        <text x={150} y={155} textAnchor="middle" fontSize="7" fill="var(--text-muted)">
          Back
        </text>
        {bodyAreas.map((a) => {
          const s = spots[a.id];
          const on = value.includes(a.id);
          return (
            <circle
              key={a.id}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={on ? 'var(--accent)' : 'transparent'}
              fillOpacity={on ? 0.55 : 0}
              stroke={on ? 'var(--accent-strong)' : 'transparent'}
              style={{ cursor: 'pointer' }}
              onClick={() => onChange(toggle(value, a.id))}
            >
              <title>{a.label}</title>
            </circle>
          );
        })}
      </svg>
      <div className="chips">
        {bodyAreas.map((a) => (
          <button key={a.id} type="button" className="chip" aria-pressed={value.includes(a.id)} onClick={() => onChange(toggle(value, a.id))}>
            {a.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
