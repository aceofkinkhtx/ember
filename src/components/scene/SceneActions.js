import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountError, cardFor, listConnections } from '../../lib/account';
import { adaptScene } from '../../lib/scene/adapt';
import { blocks, validate } from '../../lib/scene/rules';
import { saveScene, sendSceneRequest, sentRequestStatuses, withdrawSceneRequest } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { loadSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
import { displayName } from '../../screens/Connections';
// Editor actions added in M4b: sending a design to your Top as a request, and
// reusing a design with someone else.
const statusText = {
    sent: (name) => `Sent to ${name}. Waiting for them to accept it.`,
    accepted: (name) => `${name} accepted this design and is shaping it now.`,
    declined: (name) => `${name} passed on this one. You can change it and send it again.`
};
/** For a design made as the bottom: send it to the Top, see their answer. */
export function RequestCard({ scene, ctx, onChange }) {
    const { keys } = useAccount();
    const [status, setStatus] = useState(scene.request?.status ?? null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!keys || !scene.request)
            return;
        const id = scene.request.id;
        sentRequestStatuses(keys)
            .then((all) => setStatus(all[id] ?? null))
            .catch(() => undefined);
    }, [keys, scene.request]);
    const blocked = blocks(validate(scene, ctx));
    async function run(task) {
        setBusy(true);
        setError('');
        try {
            const next = await task();
            onChange(next);
            setStatus(next.request?.status ?? null);
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("section", { className: "card stack", style: { gap: 10 }, "aria-label": `Send to ${scene.partnerName}`, children: [_jsxs("div", { className: "eyebrow", children: ["A request for ", scene.partnerName] }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: status
                    ? statusText[status](scene.partnerName)
                    : `Send this to ${scene.partnerName}. They get it as a request, then accept and shape it with their own offerings and settings, or pass.` }), blocked.length > 0 && _jsx("p", { className: "note", style: { margin: 0 }, children: "Fix the red items above before sending." }), (!status || status === 'declined' || status === 'sent') && (_jsx("button", { type: "button", className: "btn btn-primary", style: { alignSelf: 'flex-start' }, disabled: busy || blocked.length > 0 || !keys, onClick: () => void run(() => sendSceneRequest(keys, scene)), children: status ? 'Send the latest version' : `Send to ${scene.partnerName}` })), status === 'sent' && (_jsx("button", { type: "button", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, disabled: busy, onClick: () => void run(() => withdrawSceneRequest(keys, scene)), children: "Take it back" })), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] }));
}
/** Pick someone, adapt the design to them, save it as a new scene. */
export function ReuseSheet({ scene, onClose }) {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [people, setPeople] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!keys)
            return;
        listConnections(keys, cardFor(settings.identity))
            .then((all) => setPeople(all.filter((c) => c.status === 'active' && c.id !== scene.connectionId)))
            .catch(() => setPeople([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys]);
    async function reuse(c) {
        if (!keys)
            return;
        setBusy(true);
        setError('');
        try {
            const role = c.myRole === 'top' ? 'top' : c.myRole === 'bottom' ? 'bottom' : scene.role;
            const data = await loadSceneData(keys, settings, c.id, c.otherId, role);
            const { scene: next, changes } = adaptScene(scene, data.ctx, {
                connectionId: c.id,
                partnerId: c.otherId,
                partnerName: displayName(c),
                role,
                intakeVersion: data.intakeVersion
            }, { title: scene.title.replace(/ with .*$/, '') + ` with ${displayName(c)}`, date: '', startTime: '' });
            const saved = await saveScene(keys, next);
            navigate(`/scenes/${saved.id}`, { state: { changes } });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't copy this design. Please try again.");
            setBusy(false);
        }
    }
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "reuse-title", onClick: onClose, children: _jsxs("div", { className: "sheet", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { id: "reuse-title", style: { margin: 0 }, children: "Use with someone else" }), _jsx("p", { style: { margin: 0 }, children: "Ember makes a new copy for them and checks it against their limits and gear. Anything that doesn't fit is taken out and listed." }), people === null ? (_jsx("p", { className: "note", children: "Loading..." })) : people.length === 0 ? (_jsx("p", { className: "note", children: "No other connections yet." })) : (_jsx("div", { className: "stack", style: { gap: 8 }, children: people.map((c) => (_jsx("button", { type: "button", className: "btn btn-outline btn-block", disabled: busy, onClick: () => void reuse(c), children: displayName(c) }, c.id))) })), error && (_jsx("p", { className: "note error", role: "alert", children: error })), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: onClose, children: "Cancel" })] }) }));
}
