import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId } from 'react';
import { roleLabel } from '../content/copy';
const roles = ['top', 'bottom', 'switch'];
/** Your usual role from setup, as a starting point for a new connection. */
export function usualRole(roles) {
    return roles === 'top' || roles === 'bottom' ? roles : 'switch';
}
/** Top, bottom or switch. Switch means either way, decided scene by scene. */
export function RolePicker({ label, value, onChange, discreet }) {
    const id = useId();
    return (_jsxs("div", { className: "field", children: [_jsx("span", { className: "field-label", id: id, children: label }), _jsx("div", { className: "segmented", role: "radiogroup", "aria-labelledby": id, style: { alignSelf: 'flex-start' }, children: roles.map((r) => (_jsx("button", { type: "button", role: "radio", "aria-checked": value === r, onClick: () => onChange(r), children: roleLabel(r, discreet).replace(/^./, (c) => c.toUpperCase()) }, r))) })] }));
}
