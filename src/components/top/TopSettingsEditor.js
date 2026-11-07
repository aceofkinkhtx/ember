import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { defaultPhaseColors, phaseColors, phaseLabels } from '../../content/phases';
import { aftercare } from '../../content/topDefaults';
import { AFTERCARE_RANGE, cadenceLabels, clampSettings, startingSettings } from '../../content/topSetup';
import { Segments, TextInput } from '../intake/Bits';
import { SettingSwitch } from '../Switch';
import { whiteTextContrast } from '../../content/contrast';
// O5 and Me > Top settings: the Top's personal standards. Default settings
// (A.C.E.'s values) are one tap away as a starting point. The safety floor still applies whatever is
// chosen here: every scene has aftercare, and an intense scene gets at least
// 30 minutes of it.
const cadences = Object.keys(cadenceLabels).map((id) => ({ id, label: cadenceLabels[id] }));
export function TopSettingsEditor({ value, onChange }) {
    const set = (patch) => onChange((s) => clampSettings({ ...s, ...patch }));
    const [colorError, setColorError] = useState('');
    const colors = phaseColors(value.phaseColors);
    function setColor(phase, color) {
        if (whiteTextContrast(color) < 4.5) {
            setColorError(`That color is too light for white text on the ${phaseLabels[phase]} phase. Try a darker one.`);
            return;
        }
        setColorError('');
        onChange((s) => ({ ...s, phaseColors: { ...s.phaseColors, [phase]: color } }));
    }
    return (_jsxs("div", { className: "stack", style: { gap: 14 }, children: [_jsxs("section", { className: "card stack", style: { gap: 10 }, children: [_jsx("div", { className: "eyebrow", children: "A ready-made start" }), _jsx("p", { className: "setting-desc", style: { margin: 0 }, children: "Aftercare at 25% of scene length (33% for intense scenes), check-ins twice a week, and a direct, warm, unhurried voice. Change anything afterward. Your sex acts choice stays as you set it." }), _jsx("button", { type: "button", className: "btn btn-outline", style: { alignSelf: 'flex-start' }, onClick: () => set(startingSettings()), children: "Default settings" })] }), _jsxs("section", { className: "card stack", style: { gap: 14 }, "aria-label": "Aftercare", children: [_jsx("div", { className: "eyebrow", children: "Aftercare" }), _jsx(Percent, { label: "Regular scenes", value: value.aftercarePercent, onChange: (aftercarePercent) => set({ aftercarePercent }) }), _jsx(Percent, { label: "Intense scenes", value: value.intensePercent, onChange: (intensePercent) => set({ intensePercent }) }), _jsxs("p", { className: "note", style: { margin: 0 }, children: ["A share of the scene's length. An intense scene always gets at least ", aftercare.intenseMinimumMinutes, " minutes, and \"more if needed\" is always there."] })] }), _jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Check-ins", children: [_jsx("div", { className: "eyebrow", children: "Between scenes" }), _jsx(Segments, { label: "Check-ins with each partner", options: cadences, value: value.checkIns, onChange: (checkIns) => set({ checkIns }) }), _jsx("p", { className: "note", style: { margin: 0 }, children: "These are your own extra check-ins. The after-scene check-ins for you both always happen." })] }), _jsxs("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Your voice", children: [_jsx("div", { className: "eyebrow", children: "Your voice" }), _jsx(TextInput, { label: "How you speak, in a few words", hint: "Used to suggest SAY lines and check-in messages. For example: playful, steady, few words.", value: value.voice, max: 120, onChange: (voice) => set({ voice }) })] }), _jsx("section", { className: "card stack", style: { gap: 12 }, "aria-label": "Sex acts", children: _jsx(SettingSwitch, { label: "Penile or oral sex can appear in my scenes", description: "Off unless you turn it on. Even then, it is only included when negotiated for that scene.", checked: value.allowNegotiatedSex, onChange: (allowNegotiatedSex) => set({ allowNegotiatedSex }) }) }), _jsxs("details", { className: "card", children: [_jsx("summary", { className: "card-title", style: { cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }, children: "Phase colors" }), _jsxs("div", { className: "stack", style: { gap: 8, marginTop: 8 }, children: [Object.keys(defaultPhaseColors).map((phase) => (_jsxs("label", { className: "person", style: { gap: 12 }, children: [_jsx("span", { style: { flex: 1, padding: '10px 12px', borderRadius: 10, background: colors[phase], color: '#fff', fontWeight: 600 }, children: phaseLabels[phase] }), _jsx("input", { type: "color", value: colors[phase], "aria-label": `${phaseLabels[phase]} color`, onChange: (e) => setColor(phase, e.target.value), style: { width: 48, height: 44, border: 'none', background: 'none' } })] }, phase))), colorError && (_jsx("p", { className: "note error", role: "alert", children: colorError })), _jsx("button", { type: "button", className: "btn btn-quiet", style: { alignSelf: 'flex-start' }, onClick: () => {
                                    setColorError('');
                                    onChange((s) => ({ ...s, phaseColors: {} }));
                                }, children: "Back to the default colors" })] })] })] }));
}
function Percent({ label, value, onChange }) {
    return (_jsxs("label", { className: "field", children: [_jsxs("span", { className: "field-label", style: { fontSize: 16 }, children: [label, ": ", _jsxs("strong", { children: [value, "%"] })] }), _jsx("input", { type: "range", min: AFTERCARE_RANGE.min, max: AFTERCARE_RANGE.max, step: 1, value: value, "aria-valuetext": `${value} percent`, onChange: (e) => onChange(Number(e.target.value)) })] }));
}
