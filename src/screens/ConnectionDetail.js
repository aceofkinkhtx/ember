import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { RolePicker } from '../components/RolePicker';
import { IntakeSummary } from '../components/intake/IntakeSummary';
import { SharePanel } from '../components/intake/SharePanel';
import { ConnectionToys } from '../components/toys/ConnectionToys';
import { readSharedProfile } from '../lib/intake';
import { AccountError, cardFor, listConnections, rolesFit, setConnectionStatus, setMyRole } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { connectionSummary, displayName } from './Connections';
// C3 (Top) and BC2 (bottom): one connection. Scenes, history and progress
// fill in here as later milestones land.
const comingSections = [
    { title: 'History', body: 'Debriefs, check-ins and what changed after each scene, so the next one starts smarter.' },
    { title: 'Progress', body: 'How your play has grown over time: new yeses, softened limits and favorite moments.' }
];
export function ConnectionDetail() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const { keys, status } = useAccount();
    const [connection, setConnection] = useState(undefined);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [theirProfile, setTheirProfile] = useState(undefined);
    useEffect(() => {
        if (!keys || !connection)
            return;
        readSharedProfile(keys, connection.otherId)
            .then(setTheirProfile)
            .catch(() => setTheirProfile(null));
    }, [keys, connection?.otherId]);
    useEffect(() => {
        if (!keys)
            return;
        listConnections(keys, cardFor(settings.identity))
            .then((all) => setConnection(all.find((c) => c.id === id && c.status !== 'ended') ?? null))
            .catch(() => setConnection(null));
        // Loaded once per visit; the card text is refreshed by the account provider.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys, id]);
    async function changeRole(role) {
        if (!connection)
            return;
        setError('');
        if (!rolesFit(connection.theirRole, role)) {
            setError("Those roles don't fit together. One of you needs to Top or S/switch, and the other to bottom or S/switch.");
            return;
        }
        const before = connection;
        setConnection({ ...connection, myRole: role });
        try {
            await setMyRole(before, role);
        }
        catch (err) {
            setConnection(before);
            setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
        }
    }
    async function change(next) {
        if (!connection)
            return;
        setBusy(true);
        setError('');
        try {
            await setConnectionStatus(connection.id, next);
            if (next === 'ended')
                navigate('/connections', { replace: true });
            else
                setConnection({ ...connection, status: next, pausedByMe: next === 'paused' });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : 'That didn\'t work. Please try again.');
        }
        finally {
            setBusy(false);
            setConfirmEnd(false);
        }
    }
    if (status === 'signed-out' || connection === null) {
        return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/connections", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Back" }), _jsx("p", { className: "card", children: "This connection isn't available." })] }));
    }
    if (!connection) {
        return (_jsx("main", { className: "screen", children: _jsx("p", { className: "note", children: "Loading..." }) }));
    }
    const name = displayName(connection);
    const paused = connection.status === 'paused';
    return (_jsxs("main", { className: "screen", children: [_jsx(Link, { to: "/connections", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, children: "\u2039 Back" }), _jsxs("div", { style: { display: 'flex', gap: 14, alignItems: 'center' }, children: [_jsx(Avatar, { ownerId: connection.otherId, photo: connection.them?.photo, name: name, size: 64 }), _jsxs("div", { children: [_jsx("h1", { style: { marginBottom: 4 }, children: name }), _jsx("p", { className: "note", style: { margin: 0 }, children: connectionSummary(connection, settings.discreet) }), paused && _jsx("span", { className: "chip", children: "Paused" })] })] }), _jsxs("section", { className: "card stack", "aria-label": "Roles", children: [_jsx(RolePicker, { label: `Your role with ${name}`, value: connection.myRole, onChange: changeRole, discreet: settings.discreet }), _jsx("p", { className: "note", children: "Each of you chooses your own role. With a S/switch, whoever designs a scene picks the role they design it as." })] }), connection.theirRole !== 'top' && (_jsxs("section", { className: "stack", "aria-labelledby": "their-profile", children: [_jsxs("h2", { id: "their-profile", className: "eyebrow", children: [name, "'s profile"] }), theirProfile === undefined ? (_jsx("p", { className: "note", children: "Loading..." })) : theirProfile ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "note", children: ["Intake #", theirProfile.version, theirProfile.full ? '' : ', essentials only'] }), _jsx(IntakeSummary, { intake: theirProfile.intake, full: theirProfile.full })] })) : (_jsxs("p", { className: "card", children: [name, " hasn't shared a profile with you yet."] }))] })), connection.myRole !== 'top' && (_jsxs("section", { className: "card stack", "aria-label": "Your sharing", children: [_jsx("div", { className: "eyebrow", children: "Your profile" }), _jsx(SharePanel, { only: connection.otherId })] })), connection.status === 'active' && (_jsxs("section", { className: "card stack", "aria-label": "Scenes", children: [_jsx("div", { className: "eyebrow", children: "Scenes" }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: connection.myRole === 'bottom'
                            ? `Design a scene for ${name} from what you said yes to. It arrives as a request they accept and shape.`
                            : connection.myRole === 'switch'
                                ? `Design a scene with ${name}, as the Top or as the bottom.`
                                : `Design a scene from what ${name} said yes to and what you offer.` }), _jsx(Link, { to: `/scenes/new?connection=${connection.id}`, className: "btn btn-primary", style: { alignSelf: 'flex-start' }, children: connection.myRole === 'bottom' ? `Design a scene for ${name}` : 'New scene' })] })), _jsx(ConnectionToys, { connection: connection, name: name }), comingSections.map((s) => (_jsxs("section", { className: "card", children: [_jsx("div", { className: "eyebrow", children: s.title }), _jsx("p", { className: "note", children: s.body })] }, s.title))), _jsxs("section", { className: "card stack", "aria-label": "Manage this connection", children: [_jsx("div", { className: "eyebrow", children: "Manage" }), paused && !connection.pausedByMe ? (_jsxs("p", { className: "note", children: [name, " paused this connection. Only they can resume it."] })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "btn btn-outline", disabled: busy, onClick: () => change(paused ? 'active' : 'paused'), children: paused ? 'Resume connection' : 'Pause connection' }), _jsx("p", { className: "note", children: paused
                                    ? 'Only you can resume it.'
                                    : 'Pausing gives you space. Everything stays as it is, no new scenes can be planned, and only you can resume.' })] })), _jsx("button", { type: "button", className: "btn btn-outline", disabled: busy, onClick: () => setConfirmEnd(true), children: "End connection" }), error && _jsx("p", { className: "note error", role: "alert", children: error })] }), confirmEnd && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "end-title", children: _jsxs("div", { className: "sheet", children: [_jsxs("h2", { id: "end-title", children: ["End your connection with ", name, "?"] }), _jsx("p", { children: "This ends it for both of you. Anything either of you shared stops being visible right away, and it leaves both your Connections lists. To connect again, one of you sends a new invite." }), _jsxs("p", { className: "note", children: ["Ember doesn't notify ", name, ". They'll see the connection is gone the next time they look."] }), _jsx("button", { type: "button", className: "btn btn-danger btn-block", disabled: busy, onClick: () => change('ended'), children: "End connection" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => setConfirmEnd(false), children: "Cancel" })] }) }))] }));
}
