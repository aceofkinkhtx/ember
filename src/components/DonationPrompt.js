import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { donationPromptDue, MIN_DONATION } from '../content/support';
import { useSettings } from '../state/settings';
import { DonateOptions } from './DonateOptions';
/** The once-a-month note about keeping Ember free. Appears on Home only. */
export function DonationPrompt() {
    const { settings, update } = useSettings();
    const [open, setOpen] = useState(() => donationPromptDue(new Date(), settings.safetyFloorAcknowledgedAt, settings.donationPromptedAt));
    // Counting starts when the note appears, whatever the person chooses.
    useEffect(() => {
        if (open)
            update({ donationPromptedAt: new Date().toISOString() });
    }, [open]);
    if (!open)
        return null;
    return (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "donate-title", children: _jsxs("div", { className: "sheet", children: [_jsx("h2", { id: "donate-title", children: "Help keep Ember free" }), _jsxs("p", { children: ["Ember has no ads, no tracking and no subscriptions, and it stays free and open for everyone. If it has been useful to you, would you chip in? Gifts start at $", MIN_DONATION, "."] }), _jsx(DonateOptions, { onDonated: () => setOpen(false) }), _jsx("button", { type: "button", className: "btn btn-quiet btn-block", onClick: () => setOpen(false), children: "Not this month" }), _jsx("p", { className: "note", children: "We'll ask at most once a month." })] }) }));
}
