import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
/** A labeled on/off row. The whole label is announced with the switch. */
export function SettingSwitch({ label, description, checked, onChange }) {
    const id = useId();
    return (_jsxs("div", { className: "setting", children: [_jsxs("div", { children: [_jsx("div", { className: "setting-label", id: `${id}-label`, children: label }), description && (_jsx("div", { className: "setting-desc", id: `${id}-desc`, children: description }))] }), _jsx("button", { type: "button", role: "switch", className: "switch", "aria-checked": checked, "aria-labelledby": `${id}-label`, "aria-describedby": description ? `${id}-desc` : undefined, onClick: () => onChange(!checked) })] }));
}
