import { useEffect, useState, type ReactNode } from 'react';
import { PIN_LENGTH } from '../lib/pin';

interface PinPadProps {
  title: string;
  message?: string;
  tone?: 'info' | 'error';
  disabled?: boolean;
  /** Called with a full PIN. The pad clears itself afterwards. */
  onComplete: (pin: string) => void;
  /** Optional control in the bottom-left key slot (for example Cancel). */
  extraKey?: ReactNode;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({ title, message, tone = 'info', disabled = false, onComplete, extraKey }: PinPadProps) {
  const [entry, setEntry] = useState('');

  useEffect(() => {
    if (entry.length === PIN_LENGTH) {
      onComplete(entry);
      setEntry('');
    }
  }, [entry, onComplete]);

  const press = (digit: string) => {
    if (!disabled) setEntry((e) => (e.length < PIN_LENGTH ? e + digit : e));
  };

  return (
    <div className="pin">
      <h1 style={{ fontSize: 26, textAlign: 'center' }}>{title}</h1>
      <div className="pin-dots" role="img" aria-label={`${entry.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} data-on={i < entry.length} />
        ))}
      </div>
      <div className="pin-message" data-tone={tone} aria-live="polite">
        {message}
      </div>
      <div className="pin-pad">
        {KEYS.map((k) => (
          <button key={k} type="button" className="pin-key" onClick={() => press(k)} disabled={disabled}>
            {k}
          </button>
        ))}
        <div>{extraKey}</div>
        <button type="button" className="pin-key" onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button
          type="button"
          className="pin-key pin-key-quiet"
          aria-label="Delete last digit"
          onClick={() => setEntry((e) => e.slice(0, -1))}
          disabled={disabled}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
