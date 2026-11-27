import { useEffect, useId, useState } from 'react';

/**
 * A whole-number box you can clear and retype (Michael, Nov 27). While it's
 * empty or out of range it shows why, keeps the last good number, and tells
 * the sheet so Save can wait.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  unit = 'minutes',
  onChange,
  onValid,
  style
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (n: number) => void;
  onValid?: (ok: boolean) => void;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(String(value));
  const errorId = useId();
  // A change from elsewhere (a slider) shows here too.
  useEffect(() => {
    setText((t) => (Number(t) === value && t !== '' ? t : String(value)));
  }, [value]);
  const n = Number(text);
  const error = text === '' || n < min ? `Enter at least ${min} ${min === 1 ? unit.replace(/s$/, '') : unit}.` : n > max ? `At most ${max} ${unit}.` : '';
  return (
    <label className="field" style={style}>
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, 4);
          setText(t);
          const v = Number(t);
          const ok = t !== '' && v >= min && v <= max;
          onValid?.(ok);
          if (ok) onChange(v);
        }}
        onBlur={() => {
          if (!error) setText(String(Number(text)));
        }}
      />
      {error && (
        <span id={errorId} className="note error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
