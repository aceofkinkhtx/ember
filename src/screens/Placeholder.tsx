import { tabLabel, type TabId } from '../content/copy';
import { useSettings } from '../state/settings';

// Stand-in for tabs that later milestones fill in.

const upcoming: Partial<Record<TabId, string>> = {
  connections: 'Invite partners, send guest links, and keep everything you know about each person in one place.',
  profile: 'Your desires, limits and aftercare, all owned by you, with control over who sees what.'
};

export function Placeholder({ tab }: { tab: TabId }) {
  const { settings } = useSettings();
  return (
    <main className="screen">
      <h1>{tabLabel(tab, settings.discreet)}</h1>
      <div className="card">
        <div className="eyebrow">On the way</div>
        <p>{upcoming[tab]}</p>
      </div>
    </main>
  );
}
