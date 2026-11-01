import { NavLink } from 'react-router-dom';
import { tabLabel, tabsByRole } from '../content/copy';
import { useSettings } from '../state/settings';
import { TabIcon } from './Icons';

export const tabPath = (tab: string) => (tab === 'home' ? '/' : `/${tab}`);

export function TabBar() {
  const { settings } = useSettings();
  return (
    <nav className="tabbar" aria-label="Main">
      {tabsByRole[settings.activeRole].map((tab) => (
        <NavLink key={tab} to={tabPath(tab)} end={tab === 'home'}>
          <TabIcon tab={tab} />
          {tabLabel(tab, settings.discreet)}
        </NavLink>
      ))}
    </nav>
  );
}
