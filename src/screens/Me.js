import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DonateOptions } from '../components/DonateOptions';
import { AvatarEditor } from '../components/Avatar';
import { IdentityForm } from '../components/IdentityForm';
import { PinSetup } from '../components/PinSetup';
import { SettingSwitch } from '../components/Switch';
import { roleLabel } from '../content/copy';
import { pronounLabel } from '../content/identity';
import { cadenceLabels, offeringsSummary } from '../content/topSetup';
import { signOut } from '../lib/account';
import { eraseAll } from '../lib/storage';
import { useAccount } from '../state/account';
import { roleFor, useSettings } from '../state/settings';
// M1 (Top) and BM1 (bottom): settings for this device.
export function Me() {
    const { settings, update } = useSettings();
    const [settingPin, setSettingPin] = useState(false);
    const [confirmErase, setConfirmErase] = useState(false);
    if (settingPin) {
        return (_jsx("div", { className: "lock", "data-theme": "live", children: _jsx(PinSetup, { onCancel: () => setSettingPin(false), onDone: (pin) => {
                    update({ pin });
                    setSettingPin(false);
                } }) }));
    }
    const roleChoices = [
        { id: 'top', label: roleLabel('top', settings.discreet) },
        { id: 'bottom', label: roleLabel('bottom', settings.discreet) },
        { id: 'both', label: 'Both' }
    ];
    return (_jsxs("main", { className: "screen", children: [_jsx("h1", { children: "Me" }), _jsx(AvatarEditor, {}), _jsxs("details", { className: "card", children: [_jsxs("summary", { className: "card-title", style: { cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }, children: ["About you", settings.identity.name || pronounLabel(settings.identity)
                                ? `: ${[settings.identity.name, pronounLabel(settings.identity)].filter(Boolean).join(', ')}`
                                : ''] }), _jsx(IdentityForm, { value: settings.identity, onChange: (change) => update((s) => ({ identity: change(s.identity) })) })] }), _jsxs("section", { className: "card", "aria-labelledby": "me-roles", children: [_jsx("div", { className: "eyebrow", id: "me-roles", children: "How you use Ember" }), _jsx("div", { className: "segmented", role: "radiogroup", "aria-labelledby": "me-roles", style: { alignSelf: 'flex-start' }, children: roleChoices.map((r) => (_jsx("button", { type: "button", role: "radio", "aria-checked": settings.roles === r.id, onClick: () => update((s) => ({
                                roles: r.id,
                                activeRole: r.id === 'both' ? s.activeRole : roleFor(r.id)
                            })), children: r.label }, r.id))) }), settings.roles !== 'bottom' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "eyebrow", id: "me-depth", style: { marginTop: 8 }, children: "Depth" }), _jsx("div", { className: "segmented", role: "radiogroup", "aria-labelledby": "me-depth", style: { alignSelf: 'flex-start' }, children: ['simple', 'studio'].map((d) => (_jsx("button", { type: "button", role: "radio", "aria-checked": settings.depth === d, onClick: () => update({ depth: d }), children: d === 'simple' ? 'Simple' : 'Studio' }, d))) })] }))] }), settings.roles !== 'bottom' && (_jsxs("section", { className: "card", "aria-labelledby": "me-top", children: [_jsx("div", { className: "eyebrow", id: "me-top", children: "As a Top" }), _jsxs(Link, { to: "/me/offerings", className: "setting", style: { color: 'inherit', textDecoration: 'none' }, children: [_jsxs("div", { children: [_jsx("div", { className: "setting-label", children: "What you offer" }), _jsx("div", { className: "setting-desc", children: offeringsSummary(settings.top) })] }), _jsx("span", { "aria-hidden": "true", children: "\u203A" })] }), _jsxs(Link, { to: "/me/top-settings", className: "setting", style: { color: 'inherit', textDecoration: 'none' }, children: [_jsxs("div", { children: [_jsx("div", { className: "setting-label", children: "Your settings" }), _jsxs("div", { className: "setting-desc", children: ["Aftercare ", settings.top.settings.aftercarePercent, "% (", settings.top.settings.intensePercent, "% intense), check-ins:", ' ', cadenceLabels[settings.top.settings.checkIns].toLowerCase()] })] }), _jsx("span", { "aria-hidden": "true", children: "\u203A" })] })] })), _jsxs("section", { className: "card", "aria-label": "Privacy", children: [_jsx("div", { className: "eyebrow", children: "Privacy" }), _jsx(SettingSwitch, { label: "Discreet mode", description: "Neutral wording inside the app and vague notification text.", checked: settings.discreet, onChange: (discreet) => update({ discreet }) }), _jsxs("div", { className: "setting", children: [_jsxs("div", { children: [_jsx("div", { className: "setting-label", children: "PIN lock" }), _jsx("div", { className: "setting-desc", children: settings.pin ? 'On. Asked each time Ember opens.' : 'Off' })] }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setSettingPin(true), children: settings.pin ? 'Change' : 'Set PIN' })] }), settings.pin && (_jsx("button", { type: "button", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, onClick: () => update({ pin: null }), children: "Turn off PIN" }))] }), _jsxs("section", { className: "card", "aria-label": "Notifications", children: [_jsx("div", { className: "eyebrow", children: "Notifications" }), _jsx(SettingSwitch, { label: "Daily tips", description: "One short note a day.", checked: settings.notifications.dailyTips, onChange: (dailyTips) => update((s) => ({ notifications: { ...s.notifications, dailyTips } })) }), _jsx(SettingSwitch, { label: "Check-in reminders", description: "A reminder about 18 hours after a scene. The check-in itself always stays in the app.", checked: settings.notifications.checkIns, onChange: (checkIns) => update((s) => ({ notifications: { ...s.notifications, checkIns } })) }), _jsx("p", { className: "note", children: "On iPhone, notifications work only after Ember is added to your Home Screen." })] }), _jsx(AccountSection, {}), _jsxs("section", { className: "card", "aria-label": "Your data", children: [_jsx("div", { className: "eyebrow", children: "Your data" }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: () => setConfirmErase(true), children: "Erase Ember from this phone" })] }), _jsxs("section", { className: "card", "aria-label": "Support Ember", children: [_jsx("div", { className: "eyebrow", children: "Support Ember" }), _jsx("p", { className: "setting-desc", children: "Ember is free and runs on donations. Any amount helps keep it that way." }), _jsx(DonateOptions, {})] }), _jsx("p", { className: "note", style: { textAlign: 'center' }, children: "Ember 0.1 \u00B7 Early preview" }), confirmErase && (_jsx("div", { className: "sheet-backdrop", role: "dialog", "aria-modal": "true", "aria-labelledby": "me-erase-title", children: _jsxs("div", { className: "sheet", children: [_jsx("h2", { id: "me-erase-title", children: "Erase everything on this phone?" }), _jsx("p", { children: "This removes your settings, PIN and keys from this phone and starts Ember over. If you have an account, you can sign in again afterward and your locked data comes back." }), _jsx("button", { type: "button", className: "btn btn-danger btn-block", onClick: () => {
                                void signOut().finally(() => {
                                    eraseAll();
                                    window.location.assign('/');
                                });
                            }, children: "Erase and start over" }), _jsx("button", { type: "button", className: "btn btn-secondary btn-block", onClick: () => setConfirmErase(false), children: "Cancel" })] }) }))] }));
}
function AccountSection() {
    const account = useAccount();
    if (account.status !== 'signed-in')
        return null;
    return (_jsxs("section", { className: "card", "aria-label": "Account", children: [_jsx("div", { className: "eyebrow", children: "Account" }), _jsxs("p", { className: "setting-desc", children: ["Signed in as ", account.email] }), _jsx("button", { type: "button", className: "btn btn-outline", onClick: async () => {
                    await signOut();
                    await account.refresh();
                }, children: "Sign out on this phone" })] }));
}
