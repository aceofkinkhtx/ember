import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { cashAppUrl, donation, donationAmounts, venmoUrl } from '../content/support';
/** Amount chips plus Cash App, Venmo and Zelle. Shared by Me and the monthly prompt. */
export function DonateOptions({ onDonated }) {
    const [amount, setAmount] = useState(donationAmounts[0]);
    const [copied, setCopied] = useState(false);
    return (_jsxs("div", { className: "stack", children: [_jsx("div", { className: "chips", role: "radiogroup", "aria-label": "Amount", children: donationAmounts.map((a) => (_jsxs("button", { type: "button", role: "radio", className: "chip", "aria-checked": amount === a, onClick: () => setAmount(a), children: ["$", a] }, a))) }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: [_jsx("a", { className: "btn btn-secondary", href: cashAppUrl(amount), target: "_blank", rel: "noreferrer", onClick: onDonated, children: "Cash App" }), _jsx("a", { className: "btn btn-secondary", href: venmoUrl(amount), target: "_blank", rel: "noreferrer", onClick: onDonated, children: "Venmo" }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => {
                            navigator.clipboard?.writeText(donation.zelle.handle).then(() => setCopied(true), () => setCopied(false));
                            onDonated?.();
                        }, children: "Zelle" })] }), _jsx("p", { className: "note", "aria-live": "polite", children: copied
                    ? `Copied ${donation.zelle.handle}. Paste it into Zelle in your bank app and send $${amount}.`
                    : `Zelle: ${donation.zelle.handle}. Tip: Venmo payments can be public, so set yours to private.` })] }));
}
