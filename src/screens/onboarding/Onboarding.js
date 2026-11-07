import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DepthIcon, RoleIcon } from '../../components/Icons';
import { EmberMark } from '../../components/EmberMark';
import { IdentityForm } from '../../components/IdentityForm';
import { PinSetup } from '../../components/PinSetup';
import { SettingSwitch } from '../../components/Switch';
import { safetyFloor } from '../../content/copy';
import { nextStep, onboardingSteps, roleFor, useSettings } from '../../state/settings';
import { OfferingsEditor } from '../../components/top/OfferingsEditor';
import { TopSettingsEditor } from '../../components/top/TopSettingsEditor';
import { useTopSetup } from '../TopSetupPages';
// O1 Welcome, About you, O2 Privacy setup, O3 Depth, O4 Offerings and O5 Top
// settings (Tops only), O6 Safety floor. O7 (first toys) needs an account, so
// toys start from the Toys tab after signing in.
function About({ progress, onNext }) {
    const { settings, update } = useSettings();
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [progress, _jsx("h1", { children: "About you" }), _jsx("p", { className: "lede", children: "So Ember can talk about you the way you want. Everything here is optional and you can change it anytime in Me." }), _jsx(IdentityForm, { value: settings.identity, onChange: (change) => update((s) => ({ identity: change(s.identity) })) }), _jsx("p", { className: "note", children: "Your partners see your name and pronouns. You decide who sees your gender identity." })] }), _jsx("footer", { className: "screen-footer", children: _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: onNext, children: "Continue" }) })] }));
}
export function Onboarding() {
    const { settings, update } = useSettings();
    const advance = () => update((s) => ({ onboarding: nextStep(s.onboarding, s.roles) }));
    const steps = onboardingSteps(settings.roles);
    const progress = (_jsx("div", { className: "progress", "aria-label": `Step ${steps.indexOf(settings.onboarding) + 1} of ${steps.length}`, children: steps.map((s, i) => (_jsx("span", { "data-on": i <= steps.indexOf(settings.onboarding) }, s))) }));
    switch (settings.onboarding) {
        case 'welcome':
            return _jsx(Welcome, { onNext: advance });
        case 'about':
            return _jsx(About, { progress: progress, onNext: advance });
        case 'privacy':
            return _jsx(Privacy, { progress: progress, onNext: advance });
        case 'depth':
            return _jsx(DepthStep, { progress: progress, onNext: advance });
        case 'offerings':
            return _jsx(OfferingsStep, { progress: progress, onNext: advance });
        case 'topSettings':
            return _jsx(TopSettingsStep, { progress: progress, onNext: advance });
        case 'safety':
            return _jsx(SafetyFloor, { progress: progress, onNext: advance });
        default:
            return null;
    }
}
const roleOptions = [
    { id: 'top', word: 'Top', desc: 'You design and lead scenes.' },
    { id: 'bottom', word: 'bottom', desc: 'You share what you want and own your limits.' },
    { id: 'both', word: 'Both', desc: 'You switch, depending on who you play with.' }
];
function Welcome({ onNext }) {
    const { settings, update } = useSettings();
    const [roles, setRoles] = useState(settings.roles);
    const [adult, setAdult] = useState(settings.ageConfirmedAt !== null);
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [_jsx("div", { style: { padding: '24px 0 8px' }, children: _jsx(EmberMark, { large: true }) }), _jsx("h1", { children: "Scenes designed with care." }), _jsx("p", { className: "lede", children: "Plan from what your partner actually wants, run it with confidence, and look after each other afterward." }), _jsxs("div", { className: "stack", role: "radiogroup", "aria-label": "How will you use Ember?", children: [_jsx("div", { className: "eyebrow", children: "How will you use Ember?" }), roleOptions.map((o) => (_jsxs("button", { type: "button", role: "radio", "aria-checked": roles === o.id, className: "choice", onClick: () => setRoles(o.id), children: [_jsx("span", { className: "choice-icon", children: _jsx(RoleIcon, { kind: o.id }) }), _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: o.word }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: o.desc })] })] }, o.id))), _jsx("p", { className: "note", children: "You can change this anytime in Me. Roles also belong to each connection, so a S/switch can Top for one partner and bottom for another." })] })] }), _jsxs("footer", { className: "screen-footer", children: [_jsxs("label", { className: "check", children: [_jsx("input", { type: "checkbox", checked: adult, onChange: (e) => setAdult(e.target.checked) }), "I'm 18 or older"] }), _jsx("button", { type: "button", className: "btn btn-primary btn-block", disabled: !roles || !adult, onClick: () => {
                            if (!roles)
                                return;
                            update({
                                roles,
                                activeRole: roleFor(roles),
                                ageConfirmedAt: settings.ageConfirmedAt ?? new Date().toISOString()
                            });
                            onNext();
                        }, children: "Continue" }), (!roles || !adult) && (_jsx("p", { className: "note", style: { textAlign: 'center' }, children: !roles ? 'Choose how you will use Ember to continue.' : 'Ember is only for adults 18 and over.' }))] })] }));
}
function Privacy({ progress, onNext }) {
    const { settings, update } = useSettings();
    const [settingPin, setSettingPin] = useState(false);
    if (settingPin) {
        return (_jsx("div", { className: "lock", "data-theme": "live", children: _jsx(PinSetup, { onCancel: () => setSettingPin(false), onDone: (pin) => {
                    update({ pin });
                    setSettingPin(false);
                } }) }));
    }
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [progress, _jsx("h1", { children: "Protect Ember first." }), _jsx("p", { className: "lede", children: "Set this up before anything personal goes in." }), _jsx("div", { className: "card", children: _jsx(SettingSwitch, { label: "Discreet mode", description: "Neutral wording inside the app, and vague notifications such as \u201CYour daily note is ready.\u201D", checked: settings.discreet, onChange: (discreet) => update({ discreet }) }) }), _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-title", children: "PIN lock" }), _jsx("p", { className: "setting-desc", children: settings.pin
                                    ? 'PIN is set. Ember will ask for it each time it opens.'
                                    : 'Ember asks for a 6-digit PIN each time it opens. Face ID and fingerprint come later.' }), _jsx("button", { type: "button", className: settings.pin ? 'btn btn-secondary' : 'btn btn-outline', onClick: () => setSettingPin(true), children: settings.pin ? 'Change PIN' : 'Set a PIN' })] }), _jsxs("div", { className: "card card-teal", children: [_jsx("div", { className: "eyebrow", children: "Our promise" }), _jsx("p", { children: "Your answers are yours. No ads, no tracking, and nothing is sold or shared. Sensitive details are encrypted on your phone before they leave it, and you decide which partners see what." })] })] }), _jsx("footer", { className: "screen-footer", children: _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: onNext, children: settings.pin ? 'Continue' : 'Continue without a PIN' }) })] }));
}
const depthOptions = [
    { id: 'simple', word: 'Simple', desc: 'Guided steps, automatic designs and a smaller set of choices. Great for starting out.' },
    { id: 'studio', word: 'Studio', desc: 'The full toolset for experienced Tops: more categories, the full gear directory and advanced options.' }
];
function DepthStep({ progress, onNext }) {
    const { settings, update } = useSettings();
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [progress, _jsx("h1", { children: "How much do you want to see?" }), _jsx("p", { className: "lede", children: "Nothing you build is lost if you switch. Change it anytime in Me." }), _jsx("div", { className: "stack", role: "radiogroup", "aria-label": "Depth", children: depthOptions.map((o) => (_jsxs("button", { type: "button", role: "radio", "aria-checked": settings.depth === o.id, className: "choice", onClick: () => update({ depth: o.id }), children: [_jsx("span", { className: "choice-icon", children: _jsx(DepthIcon, { kind: o.id }) }), _jsxs("span", { children: [_jsx("span", { className: "choice-word", children: o.word }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: o.desc })] })] }, o.id))) })] }), _jsx("footer", { className: "screen-footer", children: _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: onNext, children: "Continue" }) })] }));
}
function SkippableFooter({ onNext, started }) {
    return (_jsx("footer", { className: "screen-footer", children: _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: onNext, children: started ? 'Continue' : 'Skip for now' }) }));
}
function OfferingsStep({ progress, onNext }) {
    const { setup, studio, changeOfferings } = useTopSetup();
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [progress, _jsx("h1", { children: "What you offer" }), _jsx("p", { className: "lede", children: "Choose the kinds of play you do and how far you go. Finish or change it anytime in Me." }), _jsx(OfferingsEditor, { setup: setup, studio: studio, onChange: changeOfferings })] }), _jsx(SkippableFooter, { onNext: onNext, started: Boolean(setup.offerings.setAt) })] }));
}
function TopSettingsStep({ progress, onNext }) {
    const { setup, changeSettings } = useTopSetup();
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [progress, _jsx("h1", { children: "Your settings" }), _jsx("p", { className: "lede", children: "Your personal standards. The safety floor, next, applies whatever you choose." }), _jsx(TopSettingsEditor, { value: setup.settings, onChange: changeSettings })] }), _jsx(SkippableFooter, { onNext: onNext, started: Boolean(setup.settings.setAt) })] }));
}
function SafetyFloor({ progress, onNext }) {
    const { update } = useSettings();
    return (_jsxs("div", { className: "app", children: [_jsxs("main", { className: "screen", children: [progress, _jsx("h1", { children: "Some things never change." }), _jsx("p", { className: "lede", children: "Almost everything in Ember can be customized. These six protections can't be turned off by anyone." }), _jsx("ol", { className: "floor-list", children: safetyFloor.map((item, i) => (_jsxs("li", { children: [_jsx("span", { className: "floor-num", "aria-hidden": "true", children: i + 1 }), _jsxs("span", { children: [_jsx("strong", { children: item.title }), _jsx("span", { className: "choice-desc", style: { display: 'block' }, children: item.detail })] })] }, item.title))) })] }), _jsx("footer", { className: "screen-footer", children: _jsx("button", { type: "button", className: "btn btn-primary btn-block", onClick: () => {
                        update({ safetyFloorAcknowledgedAt: new Date().toISOString() });
                        onNext();
                    }, children: "I understand" }) })] }));
}
