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
import { SettingsProvider, useSettings, type Settings } from './state/settings';

const themeColor = { paper: '#F5EDE3', rose: '#F7E9EC' } as const;

function useTheme(guest: boolean) {
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
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/me" element={<Me />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/connections/:id" element={<ConnectionDetail />} />
        <Route path="/join/:code" element={<JoinInvite />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/toys" element={<Toys />} />
        <Route path="/toys/:id" element={<ToyEdit />} />
        <Route path="/me/offerings" element={<OfferingsPage />} />
        <Route path="/me/top-settings" element={<TopSettingsPage />} />
        <Route path="/scenes" element={<Scenes />} />
        <Route path="/scenes/new" element={<SceneNew />} />
        <Route path="/scenes/:id" element={<SceneEditor />} />
        <Route path="/scenes/:id/vibe" element={<VibeShare />} />
        <Route path="/vibes/:id" element={<VibePage />} />
        <Route path="/vibes/:id/plan" element={<PlanPage />} />
        <Route path="/scenes/:id/live" element={<LiveScene />} />
        <Route path="/vibes/:id/check" element={<BottomCheckPage />} />
        <Route path="/vibes/:id/live" element={<BottomLivePage />} />
        {tabs
          .filter((t) => t !== 'home' && t !== 'me' && t !== 'connections' && t !== 'profile' && t !== 'toys' && t !== 'scenes')
          .map((t) => (
            <Route key={t} path={`/${t}`} element={<Placeholder tab={t} />} />
          ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!live && <TabBar />}
    </div>
  );
}

function Root() {
  const { settings } = useSettings();
  // Guests have no account or setup on this phone, so their pages skip both.
  const guest = useLocation().pathname.startsWith('/guest/');
  useTheme(guest);
  if (guest) {
    return (
      <Routes>
        <Route path="/guest/:code" element={<Guest />} />
      </Routes>
    );
  }
  return <LockGate>{settings.onboarding === 'done' ? <Shell /> : <Onboarding />}</LockGate>;
}

export function App({ initialSettings }: { initialSettings?: Settings }) {
  return (
    <SettingsProvider initial={initialSettings}>
      <AccountProvider>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
      </AccountProvider>
    </SettingsProvider>
  );
}
