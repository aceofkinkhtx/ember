import { useCallback, useState } from 'react';
import { createPinRecord, PIN_LENGTH, type PinRecord } from '../lib/pin';
import { PinPad } from './PinPad';

interface PinSetupProps {
  onDone: (record: PinRecord) => void;
  onCancel: () => void;
}

/** Choose a PIN, then enter it again to confirm. */
export function PinSetup({ onDone, onCancel }: PinSetupProps) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handle = useCallback(
    async (pin: string) => {
      if (first === null) {
        setFirst(pin);
        setError('');
        return;
      }
      if (pin !== first) {
        setFirst(null);
        setError("Those didn't match. Let's start again.");
        return;
      }
      onDone(await createPinRecord(pin));
    },
    [first, onDone]
  );

  return (
    <PinPad
      title={first === null ? `Choose a ${PIN_LENGTH}-digit PIN` : 'Enter it once more'}
      message={error || (first === null ? 'You will enter this each time Ember opens.' : '')}
      tone={error ? 'error' : 'info'}
      onComplete={handle}
      extraKey={
        <button type="button" className="pin-key pin-key-quiet" onClick={onCancel}>
          Cancel
        </button>
      }
    />
  );
}
