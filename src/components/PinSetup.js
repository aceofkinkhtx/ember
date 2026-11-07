import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import { createPinRecord, PIN_LENGTH } from '../lib/pin';
import { PinPad } from './PinPad';
/** Choose a PIN, then enter it again to confirm. */
export function PinSetup({ onDone, onCancel }) {
    const [first, setFirst] = useState(null);
    const [error, setError] = useState('');
    const handle = useCallback(async (pin) => {
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
    }, [first, onDone]);
    return (_jsx(PinPad, { title: first === null ? `Choose a ${PIN_LENGTH}-digit PIN` : 'Enter it once more', message: error || (first === null ? 'You will enter this each time Ember opens.' : ''), tone: error ? 'error' : 'info', onComplete: handle, extraKey: _jsx("button", { type: "button", className: "pin-key pin-key-quiet", onClick: onCancel, children: "Cancel" }) }));
}
