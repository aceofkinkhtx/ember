import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { PIN_LENGTH } from '../lib/pin';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export function PinPad({ title, message, tone = 'info', disabled = false, onComplete, extraKey }) {
    const [entry, setEntry] = useState('');
    useEffect(() => {
        if (entry.length === PIN_LENGTH) {
            onComplete(entry);
            setEntry('');
        }
    }, [entry, onComplete]);
    const press = (digit) => {
        if (!disabled)
            setEntry((e) => (e.length < PIN_LENGTH ? e + digit : e));
    };
    return (_jsxs("div", { className: "pin", children: [_jsx("h1", { style: { fontSize: 26, textAlign: 'center' }, children: title }), _jsx("div", { className: "pin-dots", role: "img", "aria-label": `${entry.length} of ${PIN_LENGTH} digits entered`, children: Array.from({ length: PIN_LENGTH }, (_, i) => (_jsx("span", { "data-on": i < entry.length }, i))) }), _jsx("div", { className: "pin-message", "data-tone": tone, "aria-live": "polite", children: message }), _jsxs("div", { className: "pin-pad", children: [KEYS.map((k) => (_jsx("button", { type: "button", className: "pin-key", onClick: () => press(k), disabled: disabled, children: k }, k))), _jsx("div", { children: extraKey }), _jsx("button", { type: "button", className: "pin-key", onClick: () => press('0'), disabled: disabled, children: "0" }), _jsx("button", { type: "button", className: "pin-key pin-key-quiet", "aria-label": "Delete last digit", onClick: () => setEntry((e) => e.slice(0, -1)), disabled: disabled, children: "Delete" })] })] }));
}
