import { jsx as _jsx } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { roleLabel } from '../content/copy';
import { useSettings } from '../state/settings';
/** Switch between the Top and bottom views. Shown only to people who chose both. */
export function RoleToggle() {
    const { settings, update } = useSettings();
    const navigate = useNavigate();
    if (settings.roles !== 'both')
        return null;
    const pick = (role) => {
        update({ activeRole: role });
        navigate('/');
    };
    return (_jsx("div", { className: "segmented", role: "radiogroup", "aria-label": "View", children: ['top', 'bottom'].map((role) => (_jsx("button", { type: "button", role: "radio", "aria-checked": settings.activeRole === role, onClick: () => pick(role), children: roleLabel(role, settings.discreet) }, role))) }));
}
