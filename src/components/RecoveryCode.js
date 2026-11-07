import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { formatRecoveryCode } from '../lib/crypto';
/** Shown once, right after the account is made. */
export function RecoveryCode({ code, onDone }) {
    const [saved, setSaved] = useState(false);
    const [copied, setCopied] = useState(false);
    const pretty = formatRecoveryCode(code);
    return (_jsxs("section", { className: "card stack", style: { gap: 16 }, "aria-labelledby": "recovery-title", children: [_jsx("h2", { id: "recovery-title", children: "Your recovery code" }), _jsx("p", { children: "This is the spare key to your private data. If you forget your password, this code is the only way to get your data back. Ember can't recover it for you, and you'll only see it this once." }), _jsx("p", { "aria-label": "Recovery code", style: { fontFamily: 'ui-monospace, monospace', fontSize: 20, letterSpacing: 1, textAlign: 'center', wordBreak: 'break-word', userSelect: 'all' }, children: pretty }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => {
                    void navigator.clipboard?.writeText(pretty).then(() => setCopied(true), () => setCopied(false));
                }, children: copied ? 'Copied' : 'Copy code' }), _jsx("p", { className: "note", children: "Save it in a password manager or write it down somewhere private. Don't send it to anyone." }), _jsxs("label", { className: "check", children: [_jsx("input", { type: "checkbox", checked: saved, onChange: (e) => setSaved(e.target.checked) }), "I saved my recovery code"] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: !saved, onClick: onDone, children: "Continue" })] }));
}
