import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountForm } from '../../components/AccountForm';
import { SharePanel } from '../../components/intake/SharePanel';
import { AccountError } from '../../lib/account';
import { clearDraft, emptyIntake, loadDraft, saveDraft, saveVersion } from '../../lib/intake';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { IntakeFlow } from './IntakeFlow';
// The member's intake: the flow, with the draft saved on this phone as it
// changes, then save as a numbered version and choose who sees it.
export function IntakePage() {
    const navigate = useNavigate();
    const [draft, setDraft] = useState(() => loadDraft() ?? { intake: emptyIntake(), basedOn: null });
    useEffect(() => {
        saveDraft(draft);
    }, [draft]);
    return (_jsx(IntakeFlow, { value: draft.intake, onChange: (intake) => setDraft((d) => ({ ...d, intake })), title: draft.basedOn ? `New intake, starting from #${draft.basedOn.version}` : 'New intake', review: (intake) => _jsx(SaveAndShare, { draft: { ...draft, intake }, onDone: () => navigate('/profile') }) }));
}
function SaveAndShare({ draft, onDone }) {
    const { settings } = useSettings();
    const account = useAccount();
    const [saved, setSaved] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (account.status === 'signed-out') {
        return _jsx(AccountForm, { intro: "Saving your intake needs an account, so it can be locked and shared only with the Tops you choose. Your answers are kept on this phone until then." });
    }
    if (saved) {
        return (_jsxs("section", { className: "card stack", style: { gap: 14 }, children: [_jsxs("h2", { children: ["Saved as intake #", saved.version] }), _jsx("p", { children: "Choose who can see it. You can change this anytime in your profile." }), _jsx(SharePanel, {}), _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: onDone, children: "Done" })] }));
    }
    async function save(intake) {
        if (!account.keys)
            return;
        setBusy(true);
        setError('');
        try {
            const v = await saveVersion(account.keys, settings.identity, { ...draft, intake });
            clearDraft();
            setSaved(v);
        }
        catch (err) {
            setError(err instanceof AccountError ? err.message : "Ember couldn't save your intake. Please try again.");
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { className: "stack", children: [error && _jsx("p", { className: "note error", role: "alert", children: error }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: busy || account.status !== 'signed-in', onClick: () => save(draft.intake), children: busy ? 'Locking and saving...' : 'Save this intake' }), _jsx("p", { className: "note", children: "It's locked on this phone first. Only the Tops you choose can open it." })] }));
}
