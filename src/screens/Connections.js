import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountForm } from '../components/AccountForm';
import { Avatar } from '../components/Avatar';
import { IntakeSummary } from '../components/intake/IntakeSummary';
import { RolePicker, usualRole } from '../components/RolePicker';
import { roleLabel, tabLabel } from '../content/copy';
import { AccountError, cancelInvite, cardFor, createInvite, cleanCode, complement, getMyCode, listConnections, listMyInvites, listRequests, openGuestAnswers, respondToRequest, rolesFit, saveMyCode, withdrawRequest } from '../lib/account';
import { readJson, writeJson } from '../lib/storage';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
// C1 (Top) and BC1 (bottom): everyone you play with, plus Invite (C2) and
// joining with a code.
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const shortDate = (iso) => dateFmt.format(new Date(iso));
const SORT_KEY = 'ember.connectionSort';
const sortOptions = [
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
    { id: 'name', label: 'Name' }
];
function sorted(list, by) {
    const copy = [...list];
    if (by === 'name')
        return copy.sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }));
    copy.sort((a, b) => a.since.localeCompare(b.since));
    return by === 'oldest' ? copy : copy.reverse();
}
export function displayName(c) {
    return c.them?.name || (c.ready ? 'Your connection' : 'Finishing setup...');
}
export function connectionSummary(c, discreet) {
    return [c.them?.pronouns, `You: ${roleLabel(c.myRole, discreet)}`, `Them: ${roleLabel(c.theirRole, discreet)}`, `Since ${shortDate(c.since)}`]
        .filter(Boolean)
        .join(' · ');
}
export function Connections() {
    const { settings } = useSettings();
    const account = useAccount();
    const title = tabLabel('connections', settings.discreet);
    if (account.status === 'loading') {
        return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: title }), _jsx("p", { className: "note", children: "Loading..." })] }));
    }
    if (account.status === 'signed-out') {
        return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: title }), _jsx(AccountForm, { intro: "Connecting with someone needs an account, so your answers can travel to them locked. Everything personal is encrypted on this phone first." })] }));
    }
    return _jsx(ConnectionsSignedIn, { title: title });
}
function ConnectionsSignedIn({ title }) {
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [connections, setConnections] = useState(null);
    const [invites, setInvites] = useState([]);
    const [answers, setAnswers] = useState({});
    const [error, setError] = useState('');
    const [inviting, setInviting] = useState(false);
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const me = cardFor(settings.identity);
    const load = useCallback(async () => {
        if (!keys)
            return;
        try {
            setError('');
            const [conns, mine, requests] = await Promise.all([listConnections(keys, me), listMyInvites(keys), listRequests(keys)]);
            setConnections(conns);
            setInvites(mine);
            setIncoming(requests.incoming);
            setOutgoing(requests.outgoing);
            const opened = {};
            for (const inv of mine)
                if (inv.sealedAnswers)
                    opened[inv.id] = await openGuestAnswers(keys, inv.sealedAnswers);
            setAnswers(opened);
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't load your connections.");
            setConnections((c) => c ?? []);
        }
        // The card text is what matters, not the object identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys, me.name, me.pronouns]);
    useEffect(() => {
        void load();
    }, [load]);
    const guests = invites.filter((i) => i.kind === 'guest' && (i.sealedAnswers || new Date(i.expiresAt) > new Date()));
    const pending = invites.filter((i) => i.kind === 'account' && !i.used && new Date(i.expiresAt) > new Date());
    const isTop = settings.activeRole === 'top';
    // Ended connections leave both lists; only a new invite brings them back.
    const active = (connections ?? []).filter((c) => c.status !== 'ended');
    const [sort, setSort] = useState(() => readJson(SORT_KEY) ?? 'newest');
    const chooseSort = (next) => {
        setSort(next);
        writeJson(SORT_KEY, next);
    };
    return (_jsxs("main", { className: "screen", children: [_jsx("div", { className: "topbar", children: _jsx("h1", { children: title }) }), error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsxs("div", { className: "stack", children: [_jsx("button", { type: "button", className: `btn btn-block ${isTop ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setInviting(true), children: "Invite someone" }), _jsx(JoinWithCode, { primary: !isTop })] }), incoming.length > 0 && (_jsxs("section", { className: "stack", "aria-labelledby": "requests-title", children: [_jsx("h2", { id: "requests-title", className: "eyebrow", children: "Requests for you" }), _jsx("ul", { className: "person-list", children: incoming.map((r) => (_jsx(IncomingCard, { request: r, onDone: load }, r.id))) })] })), outgoing.length > 0 && (_jsxs("section", { className: "stack", "aria-labelledby": "sent-title", children: [_jsx("h2", { id: "sent-title", className: "eyebrow", children: "Requests you sent" }), _jsx("ul", { className: "person-list", children: outgoing.map((r) => (_jsxs("li", { className: "card person", children: [_jsxs("div", { children: [_jsx("div", { className: "person-name", children: r.status === 'declined' ? 'Not accepted' : 'Waiting for an answer' }), _jsxs("div", { className: "note", children: ["Sent ", shortDate(r.sentAt)] })] }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: async () => {
                                        await withdrawRequest(r.id).catch(() => undefined);
                                        void load();
                                    }, children: r.status === 'declined' ? 'Clear' : 'Withdraw' })] }, r.id))) })] })), _jsxs("section", { className: "stack", "aria-labelledby": "people-title", children: [_jsxs("div", { className: "person", children: [_jsx("h2", { id: "people-title", className: "eyebrow", children: "Connected" }), active.length > 1 && (_jsxs("label", { className: "note", style: { display: 'flex', gap: 8, alignItems: 'center' }, children: ["Sort", _jsx("select", { className: "input", style: { minHeight: 40, padding: '6px 10px' }, value: sort, onChange: (e) => chooseSort(e.target.value), children: sortOptions.map((o) => (_jsx("option", { value: o.id, children: o.label }, o.id))) })] }))] }), connections === null ? (_jsx("p", { className: "note", children: "Loading..." })) : active.length === 0 ? (_jsx("div", { className: "card", children: _jsx("p", { children: "No one yet. Invite someone, or enter the code someone sent you." }) })) : (_jsx("ul", { className: "person-list", children: sorted(active, sort).map((c) => (_jsx("li", { children: _jsxs(Link, { to: `/connections/${c.id}`, className: "card person", style: { color: 'inherit', textDecoration: 'none', flexDirection: 'row', alignItems: 'center', gap: 12 }, children: [_jsx(Avatar, { ownerId: c.otherId, photo: c.them?.photo, name: displayName(c) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { className: "person-name", children: displayName(c) }), _jsx("div", { className: "note", children: connectionSummary(c, settings.discreet) })] }), c.status === 'paused' ? _jsx("span", { className: "chip", children: "Paused" }) : _jsx("span", { "aria-hidden": "true", children: "\u203A" })] }) }, c.id))) }))] }), _jsx(MyCode, {}), guests.length > 0 && (_jsxs("section", { className: "stack", "aria-labelledby": "guests-title", children: [_jsx("h2", { id: "guests-title", className: "eyebrow", children: "Guest links" }), _jsx("ul", { className: "person-list", children: guests.map((g) => {
                            const a = answers[g.id];
                            return (_jsx("li", { className: "card stack", children: g.sealedAnswers ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "person-name", children: a?.name || 'A guest' }), a?.pronouns && _jsx("div", { className: "note", children: a.pronouns }), a?.message && _jsx("p", { children: a.message }), a?.intake && (_jsxs("details", { children: [_jsx("summary", { className: "btn btn-quiet", style: { cursor: 'pointer' }, children: "See their intake" }), _jsx(IntakeSummary, { intake: a.intake })] })), !a && _jsx("p", { className: "note", children: "These answers couldn't be opened on this phone." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "person-name", children: "Waiting for answers" }), _jsxs("div", { className: "note", children: ["Sent ", shortDate(g.createdAt), ", works until ", shortDate(g.expiresAt)] }), _jsx(CancelButton, { id: g.id, onDone: load })] })) }, g.id));
                        }) })] })), pending.length > 0 && (_jsxs("section", { className: "stack", "aria-labelledby": "pending-title", children: [_jsx("h2", { id: "pending-title", className: "eyebrow", children: "Invites waiting" }), _jsx("ul", { className: "person-list", children: pending.map((p) => (_jsxs("li", { className: "card person", children: [_jsxs("div", { children: [_jsx("div", { className: "person-name code", children: p.code }), _jsxs("div", { className: "note", children: ["Works until ", shortDate(p.expiresAt)] })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx(CopyButton, { text: p.code, label: "Copy" }), _jsx(CancelButton, { id: p.id, onDone: load })] })] }, p.id))) })] })), inviting && (_jsx(InviteSheet, { onClose: () => {
                    setInviting(false);
                    void load();
                } }))] }));
}
function CopyButton({ text, label }) {
    const [copied, setCopied] = useState(false);
    return (_jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        }, () => undefined), children: copied ? 'Copied' : label }));
}
function CancelButton({ id, onDone }) {
    const [busy, setBusy] = useState(false);
    return (_jsx("button", { type: "button", className: "btn btn-quiet", disabled: busy, onClick: async () => {
            setBusy(true);
            await cancelInvite(id).catch(() => undefined);
            onDone();
        }, children: "Cancel" }));
}
function JoinWithCode({ primary }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(primary);
    const [code, setCode] = useState('');
    const clean = cleanCode(code);
    const ok = clean.length >= 4 && clean.length <= 24;
    if (!open) {
        return (_jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => setOpen(true), children: "I have a code" }));
    }
    return (_jsxs("form", { className: "card stack", onSubmit: (e) => {
            e.preventDefault();
            if (ok)
                navigate(`/join/${clean}`);
        }, children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Join with a code" }), _jsx("span", { className: "field-hint", children: "An invite code, or someone's personal code." }), _jsx("input", { className: "input code", autoCapitalize: "characters", autoComplete: "off", spellCheck: false, maxLength: 30, value: code, onChange: (e) => setCode(e.target.value) })] }), _jsx("button", { type: "submit", className: "btn btn-secondary btn-block", disabled: !ok, children: "Look up code" })] }));
}
const paths = [
    { id: 'detailed', label: 'Detailed', desc: 'Every activity, one by one' },
    { id: 'words', label: 'Word groups', desc: 'Quick picks from groups of words' },
    { id: 'map', label: 'Desire map', desc: 'Place feelings on a map' }
];
function InviteSheet({ onClose }) {
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [kind, setKind] = useState('account');
    const [path, setPath] = useState('detailed');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [made, setMade] = useState(null);
    const [copied, setCopied] = useState(false);
    const [role, setRole] = useState(usualRole(settings.roles));
    async function make() {
        if (!keys)
            return;
        setBusy(true);
        setError('');
        try {
            const me = cardFor(settings.identity);
            setMade(await createInvite(keys, {
                kind,
                role,
                path: role !== 'bottom' ? path : null,
                note: { name: me.name, pronouns: me.pronouns, message: message.trim() }
            }));
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't make the invite. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    // The shared text stays plain so it reveals nothing if someone else sees it.
    const shareText = made ? `Here's my private link: ${made.link}` : '';
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "invite-title", children: _jsxs("div", { className: "sheet stack", style: { gap: 16 }, children: [_jsx("h2", { id: "invite-title", children: "Invite someone" }), !made ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "stack", role: "radiogroup", "aria-label": "Kind of invite", children: [
                                ['account', 'Invite to Ember', 'They make an account and you stay connected.'],
                                ['guest', 'Send a guest link', 'They answer in the browser, with nothing to install.']
                            ].map(([id, label, desc]) => (_jsx("button", { type: "button", className: "choice", role: "radio", "aria-checked": kind === id, onClick: () => setKind(id), children: _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: label }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: desc })] }) }, id))) }), _jsx(RolePicker, { label: "Your role with them", value: role, onChange: setRole, discreet: settings.discreet }), role !== 'bottom' && (_jsxs("fieldset", { className: "field", children: [_jsx("legend", { className: "field-label", children: "Suggested way to answer" }), _jsx("span", { className: "field-hint", children: "They can switch anytime." }), _jsx("div", { className: "chips", children: paths.map((p) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": path === p.id, title: p.desc, onClick: () => setPath(p.id), children: p.label }, p.id))) })] })), _jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "A note from you (optional)" }), _jsx("span", { className: "field-hint", children: "Locked inside the link, so only they can read it." }), _jsx("textarea", { className: "input", rows: 2, maxLength: 140, value: message, onChange: (e) => setMessage(e.target.value) })] }), error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy, onClick: make, children: busy ? 'Making your link...' : 'Make link' })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { children: kind === 'guest'
                                ? 'Send this link to your guest. It works once and expires in 7 days.'
                                : 'Send this link, or read them the code to type in Ember. It works once and expires in 7 days.' }), _jsxs("div", { className: "card person", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Code" }), _jsx("div", { className: "code", style: { fontSize: 22 }, children: made.code })] }), _jsx(CopyButton, { text: made.code, label: "Copy code" })] }), typeof navigator.share === 'function' && (_jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => void navigator.share({ text: shareText }).catch(() => undefined), children: "Share link" })), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => void navigator.clipboard?.writeText(made.link).then(() => setCopied(true), () => undefined), children: copied ? 'Link copied' : 'Copy link' }), _jsx("p", { className: "note", children: "Your note only shows when they open the link. Typing the code shows your role, not your note." })] })), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: onClose, children: made ? 'Done' : 'Cancel' })] }) }));
}
const CODE_HINT = 'Use 4 to 20 letters and numbers. Anyone who types it sees your scene name and role, then sends a request you accept or decline.';
/** Your permanent personal code. */
function MyCode() {
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [code, setCode] = useState(undefined);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({ code: '', sceneName: '', role: 'switch', active: true });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!keys)
            return;
        getMyCode(keys)
            .then(setCode)
            .catch(() => setCode(null));
    }, [keys]);
    // The scene name and role shown with the code always match the Me tab.
    const sceneName = settings.identity.name.trim();
    const role = usualRole(settings.roles);
    function startEditing() {
        setDraft(code ?? { code: cleanCode(sceneName).slice(0, 20), sceneName, role, active: true });
        setError('');
        setEditing(true);
    }
    async function save(next) {
        if (!keys)
            return;
        setBusy(true);
        setError('');
        try {
            const withMe = { ...next, code: cleanCode(next.code), sceneName, role };
            await saveMyCode(keys, withMe);
            setCode(withMe);
            setEditing(false);
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't save your code. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    if (code === undefined)
        return null;
    const link = code ? `${window.location.origin}/join/${code.code}` : '';
    const draftCode = cleanCode(draft.code);
    const draftOk = draftCode.length >= 4 && draftCode.length <= 20 && sceneName.length > 0;
    return (_jsxs("section", { className: "card stack", "aria-labelledby": "mycode-title", children: [_jsx("h2", { id: "mycode-title", className: "eyebrow", children: "Your personal code" }), editing ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "field", children: [_jsx("span", { className: "field-label", children: "Code" }), _jsx("span", { className: "field-hint", children: CODE_HINT }), _jsx("input", { className: "input code", autoCapitalize: "characters", autoComplete: "off", spellCheck: false, maxLength: 20, value: draft.code, onChange: (e) => setDraft({ ...draft, code: cleanCode(e.target.value) }) })] }), _jsx("p", { className: "note", children: sceneName
                            ? `Shown with it: ${sceneName} · ${roleLabel(role, settings.discreet)}. These come from the Me tab, so change them there.`
                            : 'Add a scene name in the Me tab first, under About you. It is shown with your code.' }), error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: !draftOk || busy, onClick: () => save(draft), children: busy ? 'Saving...' : 'Save code' }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => setEditing(false), children: "Cancel" })] })) : code ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "person", children: [_jsxs("div", { children: [_jsx("div", { className: "code", style: { fontSize: 22, opacity: code.active ? 1 : 0.5 }, children: code.code }), _jsxs("div", { className: "note", children: [sceneName || code.sceneName, " \u00B7 ", roleLabel(role, settings.discreet), code.active ? '' : ' · Turned off'] })] }), _jsx(CopyButton, { text: code.code, label: "Copy code" })] }), code.active && (_jsxs("div", { className: "person", style: { justifyContent: 'flex-start', flexWrap: 'wrap' }, children: [_jsx(CopyButton, { text: link, label: "Copy link" }), typeof navigator.share === 'function' && (_jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => void navigator.share({ text: `Connect with me on Ember: ${link}` }).catch(() => undefined), children: "Share" }))] })), _jsx("p", { className: "note", children: code.active
                            ? 'Share it anywhere. Every request waits for you to accept or decline.'
                            : 'Your code is off. No one can send you requests with it.' }), error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsxs("div", { className: "person", style: { justifyContent: 'flex-start', flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", className: "btn btn-outline", onClick: startEditing, children: "Change" }), _jsx("button", { type: "button", className: "btn btn-outline", disabled: busy, onClick: () => save({ ...code, active: !code.active }), children: code.active ? 'Turn off' : 'Turn on' })] })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { children: "Make a permanent code people can use to find you, like a handle. You pick it, and you approve everyone who uses it." }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: startEditing, children: "Make my code" })] }))] }));
}
/** A request someone sent with your personal code. */
function IncomingCard({ request, onDone }) {
    const { settings } = useSettings();
    const { keys } = useAccount();
    const [myRole, setMyRole] = useState(complement(request.fromRole));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fits = rolesFit(request.fromRole, myRole);
    const name = request.from?.name || 'Someone';
    async function answer(a) {
        if (!keys)
            return;
        setBusy(true);
        setError('');
        try {
            await respondToRequest(keys, request.id, a.accept ? { accept: true, myRole, me: cardFor(settings.identity) } : a);
            onDone();
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
            setBusy(false);
        }
    }
    return (_jsxs("li", { className: "card stack", children: [_jsxs("div", { children: [_jsxs("div", { className: "person-name", children: [name, request.from?.pronouns ? ` (${request.from.pronouns})` : ''] }), _jsxs("div", { className: "note", children: ["Wants to connect as ", roleLabel(request.fromRole, settings.discreet), " \u00B7 Sent ", shortDate(request.sentAt)] })] }), _jsx(RolePicker, { label: `Your role with ${name}`, value: myRole, onChange: setMyRole, discreet: settings.discreet }), !fits && _jsx("p", { className: "note", children: "Those roles don't fit together. One of you needs to Top or S/switch, and the other to bottom or S/switch." }), error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy || !fits, onClick: () => answer({ accept: true }), children: "Accept" }), _jsxs("div", { className: "person", children: [_jsx("button", { type: "button", className: "btn btn-quiet", disabled: busy, onClick: () => answer({ accept: false, block: false }), children: "Decline" }), _jsx("button", { type: "button", className: "btn btn-quiet", disabled: busy, onClick: () => answer({ accept: false, block: true }), children: "Decline and block" })] }), _jsx("p", { className: "note", children: "Declining is quiet: they only see \"not accepted.\" Blocking also stops their future requests, without telling them." })] }));
}
