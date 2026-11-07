import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IntakeSummary } from '../components/intake/IntakeSummary';
import { SharePanel } from '../components/intake/SharePanel';
import { tabLabel } from '../content/copy';
import { clearDraft, deleteVersion, emptyIntake, listVersions, loadDraft, saveDraft } from '../lib/intake';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
// BP1 and BP3: everything you've shared, every intake version, and who sees it.
// An intake can be filled for every scene, starting fresh or from an earlier one.
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export function Profile() {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const { keys, status } = useAccount();
    const [versions, setVersions] = useState(null);
    const [draft, setDraftState] = useState(() => loadDraft());
    const [confirmDelete, setConfirmDelete] = useState(null);
    useEffect(() => {
        if (!keys) {
            setVersions([]);
            return;
        }
        listVersions(keys)
            .then(setVersions)
            .catch(() => setVersions([]));
    }, [keys]);
    function start(from) {
        saveDraft(from ? { intake: from.intake, basedOn: { id: from.id, version: from.version } } : { intake: emptyIntake(), basedOn: null });
        navigate('/intake');
    }
    const latest = versions?.[0];
    return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: tabLabel('profile', settings.discreet) }), draft && (_jsxs("section", { className: "card stack", children: [_jsx("div", { className: "eyebrow", children: "In progress" }), _jsxs("p", { children: ["You have an intake you haven't saved yet", draft.basedOn ? `, starting from #${draft.basedOn.version}` : '', "."] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => navigate('/intake'), children: "Continue" }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => {
                            clearDraft();
                            setDraftState(null);
                        }, children: "Discard it" })] })), versions === null ? (_jsx("p", { className: "note", children: "Loading..." })) : !latest ? (!draft && (_jsxs("section", { className: "card stack", children: [_jsx("p", { children: "Your intake tells a Top what you want, what's off limits and how you like to be cared for. Fill one for each scene, or reuse one you've saved. You choose who sees it." }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => start(null), children: "Start your intake" })] }))) : (_jsxs(_Fragment, { children: [!draft && (_jsxs("section", { className: "card stack", children: [_jsx("p", { children: "Planning another scene? Start from your latest intake and change what's different, or start blank." }), _jsxs("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => start(latest), children: ["New intake from #", latest.version] }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => start(null), children: "Start blank" })] })), _jsxs("section", { className: "stack", "aria-labelledby": "latest-title", children: [_jsxs("h2", { id: "latest-title", className: "eyebrow", children: ["Latest: intake #", latest.version, ", ", dateFmt.format(new Date(latest.createdAt))] }), _jsx(IntakeSummary, { intake: latest.intake })] }), status === 'signed-in' && (_jsxs("section", { className: "card stack", "aria-labelledby": "sharing-title", children: [_jsx("h2", { id: "sharing-title", className: "eyebrow", children: "Who sees your profile" }), _jsx(SharePanel, {})] })), versions.length > 1 && (_jsxs("section", { className: "stack", "aria-labelledby": "versions-title", children: [_jsx("h2", { id: "versions-title", className: "eyebrow", children: "Earlier intakes" }), _jsx("ul", { className: "person-list", children: versions.slice(1).map((v) => (_jsxs("li", { className: "card person", children: [_jsxs("div", { children: [_jsxs("div", { className: "person-name", children: ["Intake #", v.version] }), _jsx("div", { className: "note", children: dateFmt.format(new Date(v.createdAt)) })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => start(v), children: "Reuse" }), _jsx("button", { type: "button", className: "btn btn-quiet", onClick: () => setConfirmDelete(v), children: "Delete" })] })] }, v.id))) })] }))] })), status === 'signed-in' && (_jsxs("section", { className: "card stack", "aria-label": "Your gear", children: [_jsx("div", { className: "eyebrow", children: settings.discreet ? 'My items' : 'My gear' }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: "Keep your own collection, with photos, and choose which connections can see it." }), _jsx(Link, { to: "/toys", className: "btn btn-outline", style: { alignSelf: 'flex-start' }, children: "Open my gear" })] })), confirmDelete && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "delete-title", children: _jsxs("div", { className: "sheet", children: [_jsxs("h2", { id: "delete-title", children: ["Delete intake #", confirmDelete.version, "?"] }), _jsx("p", { children: "It's removed for you and anyone you shared it with. This can't be undone." }), _jsx("button", { type: "button", className: "btn btn-danger btn-block", onClick: async () => {
                                await deleteVersion(confirmDelete.id).catch(() => undefined);
                                setVersions((list) => (list ?? []).filter((x) => x.id !== confirmDelete.id));
                                setConfirmDelete(null);
                            }, children: "Delete" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => setConfirmDelete(null), children: "Cancel" })] }) }))] }));
}
