import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { LOCKOUT_MS, MAX_ATTEMPTS, verifyPin } from '../lib/pin';
import { eraseAll, readJson, writeJson } from '../lib/storage';
import { useSettings } from '../state/settings';
import { EmberMark } from './EmberMark';
import { PinPad } from './PinPad';
// Locks Ember behind the PIN when it opens and after it has been in the
// background for a while. While hidden, a plain cover hides the screen so the
// phone's app switcher preview shows nothing.
export const RELOCK_AFTER_MS = 60_000;
const LOCK_KEY = 'ember.lock';
export function LockGate({ children }) {
    const { settings } = useSettings();
    const hasPin = settings.pin !== null;
    const [locked, setLocked] = useState(hasPin);
    const [hidden, setHidden] = useState(false);
    const hiddenAt = useRef(null);
    // Removing the PIN in settings unlocks; setting one does not lock right away.
    useEffect(() => {
        if (!hasPin)
            setLocked(false);
    }, [hasPin]);
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                hiddenAt.current = Date.now();
                setHidden(true);
            }
            else {
                setHidden(false);
                if (hasPin && hiddenAt.current !== null && Date.now() - hiddenAt.current >= RELOCK_AFTER_MS) {
                    setLocked(true);
                }
                hiddenAt.current = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [hasPin]);
    return (_jsxs(_Fragment, { children: [locked && settings.pin ? _jsx(LockScreen, { onUnlock: () => setLocked(false) }) : children, hidden && _jsx("div", { className: "cover", "data-theme": "live", "aria-hidden": "true" })] }));
}
function LockScreen({ onUnlock }) {
    const { settings } = useSettings();
    const [state, setState] = useState(() => readJson(LOCK_KEY) ?? { failures: 0, lockedUntil: 0 });
    const [now, setNow] = useState(Date.now());
    const [message, setMessage] = useState('');
    const [confirmErase, setConfirmErase] = useState(false);
    const waiting = state.lockedUntil > now;
    useEffect(() => {
        if (!waiting)
            return;
        const t = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(t);
    }, [waiting]);
    const save = (next) => {
        setState(next);
        writeJson(LOCK_KEY, next);
    };
    const attempt = async (pin) => {
        if (!settings.pin || state.lockedUntil > Date.now())
            return;
        if (await verifyPin(pin, settings.pin)) {
            save({ failures: 0, lockedUntil: 0 });
            onUnlock();
            return;
        }
        const failures = state.failures + 1;
        if (failures >= MAX_ATTEMPTS) {
            save({ failures: 0, lockedUntil: Date.now() + LOCKOUT_MS });
            setNow(Date.now());
            setMessage('');
        }
        else {
            save({ failures, lockedUntil: 0 });
            setMessage(`That PIN didn't match. ${MAX_ATTEMPTS - failures} tries left before a short wait.`);
        }
    };
    const secondsLeft = Math.ceil((state.lockedUntil - now) / 1000);
    return (_jsxs("div", { className: "lock", "data-theme": "live", children: [_jsx(EmberMark, {}), _jsx(PinPad, { title: "Enter your PIN", message: waiting ? `Too many tries. Try again in ${secondsLeft} seconds.` : message, tone: waiting || message ? 'error' : 'info', disabled: waiting, onComplete: attempt }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => setConfirmErase(true), children: "Forgot PIN?" }), confirmErase && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "erase-title", children: _jsxs("div", { className: "sheet", children: [_jsx("h2", { id: "erase-title", children: "Start over on this phone?" }), _jsx("p", { children: "A forgotten PIN can't be recovered. Starting over erases everything Ember has saved on this phone, and you'll set it up again from the beginning." }), _jsx("button", { type: "button", className: "btn btn-danger btn-block", onClick: () => {
                                eraseAll();
                                window.location.reload();
                            }, children: "Erase and start over" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => setConfirmErase(false), children: "Keep trying" })] }) }))] }));
}
