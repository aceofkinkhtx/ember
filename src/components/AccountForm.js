import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { emptyIdentity } from '../content/identity';
import { defaultTopSetupFrom } from '../content/topSetup';
import { AccountError, MIN_PASSWORD, signIn, signUp } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { RecoveryCode } from './RecoveryCode';
/** Create an account or sign in. Shown wherever an account is needed. */
export function AccountForm({ intro }) {
    const { update } = useSettings();
    const { refresh } = useAccount();
    const [mode, setMode] = useState('create');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [checkEmail, setCheckEmail] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState(null);
    if (recoveryCode) {
        return _jsx(RecoveryCode, { code: recoveryCode, onDone: () => void refresh() });
    }
    const creating = mode === 'create';
    const problem = !/^\S+@\S+\.\S+$/.test(email.trim())
        ? 'Enter your email address.'
        : password.length < MIN_PASSWORD
            ? `Your password needs at least ${MIN_PASSWORD} characters.`
            : creating && confirm !== password
                ? "The two passwords don't match yet."
                : '';
    async function submit(e) {
        e.preventDefault();
        if (problem || busy)
            return;
        setBusy(true);
        setError('');
        try {
            const result = creating ? await signUp(email, password) : await signIn(email, password);
            if (result.kind === 'confirm-email') {
                setCheckEmail(true);
                setMode('signin');
            }
            else if (result.kind === 'new') {
                setRecoveryCode(result.recoveryCode);
            }
            else {
                // A new phone: bring back "About you" if this phone has none yet.
                const saved = result.saved?.identity;
                if (saved)
                    update((s) => (s.identity.name ? {} : { identity: { ...emptyIdentity, ...saved } }));
                // The same for a Top's offerings and settings.
                const top = result.saved?.top;
                if (top)
                    update((s) => (s.top.offerings.setAt || s.top.settings.setAt ? {} : { top: defaultTopSetupFrom(top) }));
                await refresh();
            }
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : 'Something went wrong. Please try again.');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("form", { className: "card stack", style: { gap: 16 }, onSubmit: submit, noValidate: true, children: [intro && _jsx("p", { children: intro }), _jsxs("div", { className: "segmented", role: "radiogroup", "aria-label": "Account", style: { alignSelf: 'flex-start' }, children: [_jsx("button", { type: "button", role: "radio", "aria-checked": creating, onClick: () => setMode('create'), children: "Create account" }), _jsx("button", { type: "button", role: "radio", "aria-checked": !creating, onClick: () => setMode('signin'), children: "Sign in" })] }), checkEmail && (_jsx("p", { className: "card card-teal", role: "status", children: "Check your email and tap the link to confirm. If it isn't in your inbox within a few minutes, look in your spam or junk folder. Then come back here and sign in with the same password." })), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Email" }), _jsx("input", { className: "input", type: "email", autoComplete: "email", inputMode: "email", value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Password" }), creating && (_jsxs("span", { className: "field-hint", children: ["At least ", MIN_PASSWORD, " characters. Your password unlocks your private data, so Ember never sees it."] })), _jsx("input", { className: "input", type: "password", autoComplete: creating ? 'new-password' : 'current-password', value: password, onChange: (e) => setPassword(e.target.value) })] }), creating && (_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Password again" }), _jsx("input", { className: "input", type: "password", autoComplete: "new-password", value: confirm, onChange: (e) => setConfirm(e.target.value) })] })), error && (_jsx("p", { className: "note error", role: "alert", children: error })), _jsx("button", { type: "submit", className: "btn btn-primary btn-block", disabled: Boolean(problem) || busy, children: busy ? 'Unlocking your keys...' : creating ? 'Create account' : 'Sign in' }), problem && (email || password) && _jsx("p", { className: "note", children: problem }), !creating && (_jsx("p", { className: "note", children: "Forgot your password? Password reset with your recovery code arrives once Ember's email is connected." }))] }));
}
