import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { tabLabel, tabsByRole } from '../content/copy';
import { useSettings } from '../state/settings';
import { TabIcon } from './Icons';
export const tabPath = (tab) => (tab === 'home' ? '/' : `/${tab}`);
export function TabBar() {
    const { settings } = useSettings();
    return (_jsx("nav", { className: "tabbar", "aria-label": "Main", children: tabsByRole[settings.activeRole].map((tab) => (_jsxs(NavLink, { to: tabPath(tab), end: tab === 'home', children: [_jsx(TabIcon, { tab: tab }), tabLabel(tab, settings.discreet)] }, tab))) }));
}
