import { useId, type ReactNode } from 'react';

// Small building blocks shared by the intake screens.

export function toggle<T>(list: T[], item: T, max?: number): T[] {
  if (list.includes(item)) return list.filter((x) => x !== item);
  if (max && list.length >= max) return [...list.slice(1), item];
  return [...list, item];
}

/** Pick any number (or up to max) from a set of chips. */
export function Chips({
  legend,
  hint,
  options,
  value,
  onChange,
  max
}: {
  legend: string;
  hint?: string;
  options: { id: string; label: string; title?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  return (
    <fieldset className="field">
      <legend className="field-label">{legend}</legend>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="chips">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip"
            aria-pressed={value.includes(o.id)}
            title={o.title}
            onClick={() => onChange(toggle(value, o.id, max))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Pick exactly one, shown as stacked choices with an optional description. */
export function OneOf<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange
}: {
  legend: string;
  hint?: string;
  options: { id: T; label: string; desc?: string }[];
  value: T | null;
  onChange: (next: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {legend}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
      <div className="stack" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.id} type="button" className="choice" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
            <span>
              <span className="choice-word">{o.label}</span>
              {o.desc && (
                <span className="choice-desc" style={{ display: 'block' }}>
                  {o.desc}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A compact one-of control for short labels. */
export function Segments<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T | null | undefined;
  onChange: (next: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id} style={{ fontSize: 16 }}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id} style={{ alignSelf: 'flex-start' }}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 3,
  max = 2000
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  max?: number;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      <textarea className="input" rows={rows} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function TextInput({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  max = 80,
  autoComplete
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  max?: number;
  autoComplete?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      <input className="input" type={type} maxLength={max} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card stack" style={{ gap: 18 }}>
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}
