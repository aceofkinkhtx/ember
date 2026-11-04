import type { CSSProperties } from 'react';

// A slider with two handles for a low and a high end, with a tick for every
// step. Each handle is its own native slider, so keyboards and screen readers
// work as usual.

export function RangePair({
  label,
  min,
  max,
  low,
  high,
  ends,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  low: number;
  high: number;
  /** Words under each end of the scale. */
  ends: [string, string];
  onChange: (low: number, high: number) => void;
}) {
  const at = (n: number) => (n - min) / (max - min);
  const fill = { '--from': at(low), '--to': at(high) } as CSSProperties;
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="range-pair-wrap">
      <div className="range-pair" style={fill}>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={low}
          aria-label={`${label}, from`}
          aria-valuetext={`From ${low}`}
          onChange={(e) => onChange(Math.min(Number(e.target.value), high), high)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={high}
          aria-label={`${label}, up to`}
          aria-valuetext={`Up to ${high}`}
          onChange={(e) => onChange(low, Math.max(Number(e.target.value), low))}
        />
      </div>
      <div className="range-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} data-on={t >= low && t <= high} />
        ))}
      </div>
      <div className="note range-ends" aria-hidden="true">
        <span>
          {min} {ends[0]}
        </span>
        <span>
          {ends[1]} {max}
        </span>
      </div>
    </div>
  );
}
