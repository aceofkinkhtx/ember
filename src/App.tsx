import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LockGate } from './components/LockGate';
import { TabBar } from './components/TabBar';
import { tabsByRole } from './content/copy';
import { Home } from './screens/Home';
import { Me } from './screens/Me';
import { Onboarding } from './screens/onboarding/Onboarding';
import { Placeholder } from './screens/Placeholder';
import { SettingsProvider, useSettings, type Settings } from './state/settings';

const themeColor = { paper: '#F5EDE3', rose: '#F7E9EC' } as const;

function useTheme() {
  const { settings } = useSettings();
  const bottomView = settings.onboarding === 'done' ? settings.activeRole === 'bottom' : settings.roles === 'bottom';
  const theme = bottomView ? 'rose' : 'paper';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[theme]);
  }, [theme]);
}

function Shell() {
  const { settings } = useSettings();
  const tabs = tabsByRole[settings.activeRole];
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/me" element={<Me />} />
        {tabs
          .filter((t) => t !== 'home' && t !== 'me')
          .map((t) => (
            <Route key={t} path={`/${t}`} element={<Placeholder tab={t} />} />
          ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
    </div>
  );
}

function Root() {
  const { settings } = useSettings();
  useTheme();
  return <LockGate>{settings.onboarding === 'done' ? <Shell /> : <Onboarding />}</LockGate>;
}

export function App({ initialSettings }: { initialSettings?: Settings }) {
  return (
    <SettingsProvider initial={initialSettings}>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </SettingsProvider>
  );
}
