import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LockGate } from './components/LockGate';
import { TabBar } from './components/TabBar';
import { tabsByRole } from './content/copy';
import { ConnectionDetail } from './screens/ConnectionDetail';
import { Connections } from './screens/Connections';
import { Guest } from './screens/Guest';
import { Home } from './screens/Home';
import { JoinInvite } from './screens/JoinInvite';
import { Me } from './screens/Me';
import { Onboarding } from './screens/onboarding/Onboarding';
import { Placeholder } from './screens/Placeholder';
import { Profile } from './screens/Profile';
import { ToyEdit } from './screens/ToyEdit';
import { Toys } from './screens/Toys';
import { OfferingsPage, TopSettingsPage } from './screens/TopSetupPages';
import { SceneEditor } from './screens/scenes/SceneEditor';
import { SceneNew } from './screens/scenes/SceneNew';
import { Scenes } from './screens/scenes/Scenes';
import { PlanPage, VibePage } from './screens/scenes/VibePage';
import { VibeShare } from './screens/scenes/VibeShare';
import { IntakePage } from './screens/intake/IntakePage';
import { BottomCheckPage, BottomLivePage } from './screens/live/BottomLive';
import { LiveScene } from './screens/live/LiveScene';
import { AccountProvider } from './state/account';
import { SettingsProvider, useSettings } from './state/settings';
const themeColor = { paper: '#F5EDE3', rose: '#F7E9EC' };
function useTheme(guest) {
    const { settings } = useSettings();
    const bottomView = guest || (settings.onboarding === 'done' ? settings.activeRole === 'bottom' : settings.roles === 'bottom');
    const theme = bottomView ? 'rose' : 'paper';
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[theme]);
    }, [theme]);
}
function Shell() {
    const { settings } = useSettings();
    const tabs = tabsByRole[settings.activeRole];
    // Live Scene Mode fills the screen: no tab bar to tap by accident.
    const live = /\/(live|check)$/.test(useLocation().pathname);
    return (_jsxs("div", { className: "app", children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/me", element: _jsx(Me, {}) }), _jsx(Route, { path: "/connections", element: _jsx(Connections, {}) }), _jsx(Route, { path: "/connections/:id", element: _jsx(ConnectionDetail, {}) }), _jsx(Route, { path: "/join/:code", element: _jsx(JoinInvite, {}) }), _jsx(Route, { path: "/profile", element: _jsx(Profile, {}) }), _jsx(Route, { path: "/intake", element: _jsx(IntakePage, {}) }), _jsx(Route, { path: "/toys", element: _jsx(Toys, {}) }), _jsx(Route, { path: "/toys/:id", element: _jsx(ToyEdit, {}) }), _jsx(Route, { path: "/me/offerings", element: _jsx(OfferingsPage, {}) }), _jsx(Route, { path: "/me/top-settings", element: _jsx(TopSettingsPage, {}) }), _jsx(Route, { path: "/scenes", element: _jsx(Scenes, {}) }), _jsx(Route, { path: "/scenes/new", element: _jsx(SceneNew, {}) }), _jsx(Route, { path: "/scenes/:id", element: _jsx(SceneEditor, {}) }), _jsx(Route, { path: "/scenes/:id/vibe", element: _jsx(VibeShare, {}) }), _jsx(Route, { path: "/vibes/:id", element: _jsx(VibePage, {}) }), _jsx(Route, { path: "/vibes/:id/plan", element: _jsx(PlanPage, {}) }), _jsx(Route, { path: "/scenes/:id/live", element: _jsx(LiveScene, {}) }), _jsx(Route, { path: "/vibes/:id/check", element: _jsx(BottomCheckPage, {}) }), _jsx(Route, { path: "/vibes/:id/live", element: _jsx(BottomLivePage, {}) }), tabs
                        .filter((t) => t !== 'home' && t !== 'me' && t !== 'connections' && t !== 'profile' && t !== 'toys' && t !== 'scenes')
                        .map((t) => (_jsx(Route, { path: `/${t}`, element: _jsx(Placeholder, { tab: t }) }, t))), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }), !live && _jsx(TabBar, {})] }));
}
function Root() {
    const { settings } = useSettings();
    // Guests have no account or setup on this phone, so their pages skip both.
    const guest = useLocation().pathname.startsWith('/guest/');
    useTheme(guest);
    if (guest) {
        return (_jsx(Routes, { children: _jsx(Route, { path: "/guest/:code", element: _jsx(Guest, {}) }) }));
    }
    return _jsx(LockGate, { children: settings.onboarding === 'done' ? _jsx(Shell, {}) : _jsx(Onboarding, {}) });
}
export function App({ initialSettings }) {
    return (_jsx(SettingsProvider, { initial: initialSettings, children: _jsx(AccountProvider, { children: _jsx(BrowserRouter, { children: _jsx(Root, {}) }) }) }));
}
