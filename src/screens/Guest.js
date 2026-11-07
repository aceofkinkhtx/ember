import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { EmberMark } from '../components/EmberMark';
import { IdentityForm } from '../components/IdentityForm';
import { emptyIdentity, pronounLabel } from '../content/identity';
import { AccountError, lookupInvite, submitGuestAnswers } from '../lib/account';
import { emptyDetailed, emptyIntake } from '../lib/intake';
import { IntakeFlow } from './intake/IntakeFlow';
// G1 and G2: someone without an account fills the full intake in the browser.
// Answers stay in memory only (never saved in a browser that may be shared)
// and are locked for the inviter before they are sent.
export function Guest() {
    const { code = '' } = useParams();
    const { hash } = useLocation();
    const [invite, setInvite] = useState(undefined);
    const [step, setStep] = useState('welcome');
    const [intake, setIntake] = useState(emptyIntake);
    const [identity, setIdentity] = useState(emptyIdentity);
    const [message, setMessage] = useState('');
    const [adult, setAdult] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        lookupInvite(code, hash.slice(1) || undefined)
            .then((found) => {
            setInvite(found);
            // Start on the way of answering the inviter suggested.
            const suggested = { words: 'quick', map: 'map', detailed: 'detailed' };
            const path = found?.suggestedPath ? suggested[found.suggestedPath] : undefined;
            if (path)
                setIntake((i) => ({
                    ...i,
                    paths: [path],
                    quick: path === 'quick' ? { words: { heat: [], hold: [], flow: [] }, decoder: {} } : null,
                    detailed: path === 'detailed' ? emptyDetailed() : null
                }));
        })
            .catch(() => setInvite(null));
    }, [code, hash]);
    const who = invite?.note?.name || 'The person who sent this link';
    const problem = invite === null || invite?.kind === 'account'
        ? "This link doesn't work. Ask for a new one."
        : invite?.used
            ? 'This link has already been used. If that was you, your answers were sent.'
            : invite?.expired
                ? 'This link has expired. Ask for a new one.'
                : '';
    async function send() {
        if (!invite)
            return;
        setBusy(true);
        setError('');
        try {
            await submitGuestAnswers(code, invite.inviterPublicKey, {
                name: identity.name.trim(),
                pronouns: pronounLabel(identity),
                message: message.trim(),
                adultConfirmedAt: new Date().toISOString(),
                intake
            });
            setStep('done');
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Your answers weren't sent. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    if (invite && !problem && step === 'intake') {
        return (_jsx("div", { className: "app", "data-theme": "rose", children: _jsx(IntakeFlow, { value: intake, onChange: setIntake, title: `For ${who}`, review: () => (_jsxs("div", { className: "stack", children: [error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy, onClick: send, children: busy ? 'Locking and sending...' : 'Send my answers' }), _jsxs("p", { className: "note", children: ["Locked in this browser so only ", invite.note?.name || 'they', " can read it. Nothing is kept here after you leave."] })] })) }) }));
    }
    return (_jsx("div", { className: "app", "data-theme": "rose", children: _jsxs("main", { className: "screen", children: [_jsx(EmberMark, {}), invite === undefined && _jsx("p", { className: "note", children: "Opening your link..." }), problem && _jsx("p", { className: "card", children: problem }), invite && !problem && step === 'welcome' && (_jsxs(_Fragment, { children: [_jsxs("h1", { children: [who, " invited you"] }), invite.note?.message && _jsxs("p", { className: "card", children: ["\"", invite.note.message, "\""] }), _jsxs("section", { className: "card stack", children: [_jsxs("p", { children: ["Ember helps partners plan scenes with care. ", who, " would like to know a little about you before you play."] }), _jsxs("p", { children: [_jsx("strong", { children: "What they'll see:" }), " only what you enter here. ", _jsx("strong", { children: "What they won't:" }), " anything else about you, your browser, or where you are."] }), _jsxs("p", { className: "note", children: ["It takes 5 to 15 minutes, depending on how much you share. Your answers are locked in this browser before they're sent, so only ", invite.note?.name || 'they', " can read them."] })] }), _jsxs("label", { className: "check", children: [_jsx("input", { type: "checkbox", checked: adult, onChange: (e) => setAdult(e.target.checked) }), "I'm 18 or older"] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: !adult, onClick: () => setStep('answers'), children: "Start" }), !adult && _jsx("p", { className: "note", style: { textAlign: 'center' }, children: "Ember is only for adults 18 and over." })] })), invite && !problem && step === 'answers' && (_jsxs(_Fragment, { children: [_jsx("h1", { children: "About you" }), _jsx(IdentityForm, { value: identity, onChange: (change) => setIdentity((prev) => change(prev)) }), _jsxs("label", { className: "field", children: [_jsxs("span", { className: "field-label", children: ["Anything you'd like ", invite.note?.name || 'them', " to know?"] }), _jsx("span", { className: "field-hint", children: "Optional." }), _jsx("textarea", { className: "input", rows: 4, maxLength: 2000, value: message, onChange: (e) => setMessage(e.target.value) })] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => setStep('intake'), children: "Continue" })] })), step === 'done' && (_jsxs(_Fragment, { children: [_jsx("h1", { children: "Sent" }), _jsxs("section", { className: "card stack", children: [_jsxs("p", { children: [invite?.note?.name ? `${invite.note.name} has` : 'They have', " your answers now, locked so only they can read them."] }), _jsx("p", { children: "Want to keep and change your answers later, or get check-ins after a scene? Create a free Ember account. You can add it to your home screen from your browser's menu." })] }), _jsx("a", { className: "btn btn-secondary btn-block", href: "/", children: "Get Ember" })] }))] }) }));
}
