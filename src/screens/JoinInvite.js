import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AccountForm } from '../components/AccountForm';
import { RolePicker } from '../components/RolePicker';
import { roleLabel } from '../content/copy';
import { AccountError, acceptInvite, cardFor, complement, lookupInvite, lookupPersonalCode, rolesFit, sendRequest } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
export function JoinInvite() {
    const { code = '' } = useParams();
    const { hash } = useLocation();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const account = useAccount();
    const [found, setFound] = useState(undefined);
    const [myRole, setMyRole] = useState('bottom');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    useEffect(() => {
        (async () => {
            const invite = await lookupInvite(code, hash.slice(1) || undefined);
            if (invite) {
                setMyRole(complement(invite.inviterRole));
                return setFound({ kind: 'invite', invite });
            }
            const owner = await lookupPersonalCode(code);
            if (owner) {
                setMyRole(complement(owner.role));
                return setFound({ kind: 'code', owner });
            }
            setFound(null);
        })().catch((err) => {
            setError(err instanceof AccountError ? err.message : "Ember couldn't look up that code.");
            setFound(null);
        });
    }, [code, hash]);
    const invite = found?.kind === 'invite' ? found.invite : null;
    const owner = found?.kind === 'code' ? found.owner : null;
    const who = invite ? invite.note?.name || 'Someone' : owner?.sceneName ?? '';
    const pronouns = invite?.note?.pronouns;
    const theirRole = invite?.inviterRole ?? owner?.role ?? 'top';
    const fits = rolesFit(theirRole, myRole);
    const problem = found === null
        ? 'That code was not found. Check it and try again.'
        : invite?.kind === 'guest'
            ? 'This is a guest link. Open it in the browser instead.'
            : invite?.used
                ? 'This invite has already been used. Ask for a new one.'
                : invite?.expired
                    ? 'This invite has expired. Ask for a new one.'
                    : '';
    async function go() {
        if (!account.keys || !found)
            return;
        setBusy(true);
        setError('');
        try {
            const me = cardFor(settings.identity);
            if (found.kind === 'invite') {
                await acceptInvite(account.keys, code, me, myRole);
                navigate('/connections', { replace: true });
                return;
            }
            await sendRequest(code, found.owner, myRole, me);
            setSent(true);
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    if (sent) {
        return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: "Request sent" }), _jsx("section", { className: "card stack", children: _jsxs("p", { children: [who, " will see your scene name, pronouns and the role you chose, and can accept or decline. You'll find them in your Connections once they accept."] }) }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => navigate('/connections', { replace: true }), children: "Back to Connections" })] }));
    }
    return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: owner ? `Connect with ${who}` : "You're invited" }), found === undefined && !error && _jsx("p", { className: "note", children: "Looking up the code..." }), problem && _jsx("p", { className: "card", children: problem }), found && !problem && (_jsxs(_Fragment, { children: [_jsxs("section", { className: "card stack", children: [_jsxs("p", { className: "person-name", children: [who, pronouns ? ` (${pronouns})` : ''] }), _jsx("p", { className: "note", children: roleLabel(theirRole, settings.discreet).replace(/^./, (x) => x.toUpperCase()) }), invite?.note?.message && _jsxs("p", { children: ["\"", invite.note.message, "\""] })] }), _jsxs("section", { className: "card stack", children: [_jsx(RolePicker, { label: `Your role with ${who}`, value: myRole, onChange: setMyRole, discreet: settings.discreet }), _jsx("p", { className: "note", children: fits
                                    ? 'S/switch means either way: whoever designs a scene picks the role they design it as. You can change your role later.'
                                    : "Those roles don't fit together. One of you needs to Top or S/switch, and the other to bottom or S/switch." })] }), _jsxs("section", { className: "card stack", children: [_jsx("p", { children: "Ember helps partners plan scenes together: what you want, what's off limits, and how you like to be cared for afterward. You decide what each person can see." }), _jsx("p", { className: "note", children: "Your answers are locked on your phone before they leave it. Not even Ember can read them." })] }), account.status === 'signed-out' ? (_jsx(AccountForm, { intro: owner ? 'To send a request, create an account or sign in.' : 'To connect, create an account or sign in.' })) : (_jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy || !fits || account.status !== 'signed-in', onClick: go, children: busy ? 'One moment...' : owner ? 'Send request' : 'Connect' })), owner && account.status === 'signed-in' && (_jsxs("p", { className: "note", children: [who, " sees your scene name, pronouns and role, and decides whether to accept."] }))] })), error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => navigate('/connections'), children: "Not now" })] }));
}
