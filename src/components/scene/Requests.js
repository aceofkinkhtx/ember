import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountError, cardFor, listConnections } from '../../lib/account';
import { adaptScene } from '../../lib/scene/adapt';
import { acceptSceneRequest, declineSceneRequest, listIncomingRequests } from '../../lib/scenes';
import { useAccount } from '../../state/account';
import { loadSceneData } from '../../state/sceneContext';
import { useSettings } from '../../state/settings';
import { displayName } from '../../screens/Connections';
import { Avatar } from '../Avatar';
import { MiniCurve, sceneFacts } from './SceneCurve';
// Designs a connection made for you. Accepting saves your own copy with your
// offerings and settings applied (anything that doesn't fit is taken out and
// listed); passing tells them quietly, so they can change it and send again.
export function SceneRequests() {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!keys)
            return;
        Promise.all([listIncomingRequests(keys), listConnections(keys, cardFor(settings.identity))])
            .then(([incoming, people]) => setRequests(incoming.flatMap((request) => {
            const from = people.find((c) => c.otherId === request.fromId && c.status !== 'ended');
            return from ? [{ request, from }] : [];
        })))
            .catch(() => setRequests([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keys]);
    async function accept(request, from) {
        if (!keys)
            return;
        setBusy(request.id);
        setError('');
        try {
            const role = request.scene.role === 'bottom' ? 'top' : 'bottom';
            const data = await loadSceneData(keys, settings, from.id, from.otherId, role);
            const { scene, changes } = adaptScene(request.scene, data.ctx, { connectionId: from.id, partnerId: from.otherId, partnerName: displayName(from), role, intakeVersion: data.intakeVersion }, {
                fromRequest: { by: displayName(from), at: request.sentAt },
                // A default title names the partner, so it should name them from this side.
                title: request.scene.title.startsWith('Scene with ') ? `Scene with ${displayName(from)}` : request.scene.title
            });
            const saved = await acceptSceneRequest(keys, request, scene);
            navigate(`/scenes/${saved.id}`, { state: { changes } });
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't accept that. Please try again.");
            setBusy(null);
        }
    }
    async function pass(request) {
        setBusy(request.id);
        setError('');
        try {
            await declineSceneRequest(request.id);
            setRequests((r) => r.filter((x) => x.request.id !== request.id));
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
        }
        finally {
            setBusy(null);
        }
    }
    if (!requests.length && !error)
        return null;
    return (_jsxs("section", { className: "stack", style: { gap: 10 }, "aria-label": "Requests", children: [_jsx("div", { className: "eyebrow", children: "Designed for you" }), requests.map(({ request, from }) => (_jsxs("article", { className: "card stack", style: { gap: 8 }, "aria-label": request.scene.title, children: [_jsxs("div", { className: "person", children: [_jsx(Avatar, { ownerId: from.otherId, photo: from.them?.photo, name: displayName(from), size: 36 }), _jsx("span", { className: "person-name", style: { flex: 1 }, children: request.scene.title }), _jsxs("span", { className: "note", children: ["from ", displayName(from)] })] }), _jsx(MiniCurve, { scene: request.scene, height: 44 }), _jsxs("span", { className: "note", children: [sceneFacts(request.scene), request.scene.date ? `, for ${new Date(`${request.scene.date}T12:00`).toLocaleDateString()}` : ''] }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", className: "btn btn-primary", disabled: busy !== null, onClick: () => void accept(request, from), children: "Accept and edit" }), _jsx("button", { type: "button", className: "btn btn-quiet", disabled: busy !== null, onClick: () => void pass(request), children: "Pass" })] })] }, request.id))), error && (_jsx("p", { className: "note error", role: "alert", children: error }))] }));
}
