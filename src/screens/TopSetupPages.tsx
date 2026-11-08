import { Link } from 'react-router-dom';
import { OfferingsEditor } from '../components/top/OfferingsEditor';
import { TopSettingsEditor } from '../components/top/TopSettingsEditor';
import type { Offerings, TopSettings } from '../content/topSetup';
import { useSettings } from '../state/settings';

// Me > Offerings (O4) and Me > Top settings (O5). Changes save as you go.

export function useTopSetup() {
  const { settings, update } = useSettings();
  const now = () => new Date().toISOString();
  return {
    setup: settings.top,
    changeOfferings: (change: (o: Offerings) => Offerings) =>
      update((s) => ({ top: { ...s.top, offerings: { ...change(s.top.offerings), setAt: now() } } })),
    changeSettings: (change: (t: TopSettings) => TopSettings) =>
      update((s) => ({ top: { ...s.top, settings: { ...change(s.top.settings), setAt: now() } } }))
  };
}

function Back() {
  return (
    <Link to="/me" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
      ‹ Me
    </Link>
  );
}

export function OfferingsPage() {
  const { setup, changeOfferings } = useTopSetup();
  return (
    <main className="screen">
      <Back />
      <h1>What you offer</h1>
      <p className="lede">Choose the kinds of play you do and how far you go. Scene designs only use what you offer here.</p>
      <OfferingsEditor setup={setup} onChange={changeOfferings} />
      <p className="note">Edge play is never on by default. Turn on each kind you offer, and it is only added to a scene after you confirm it was negotiated.</p>
    </main>
  );
}

export function TopSettingsPage() {
  const { setup, changeSettings } = useTopSetup();
  return (
    <main className="screen">
      <Back />
      <h1>Your settings</h1>
      <p className="lede">Your personal standards. The safety floor applies whatever you choose.</p>
      <TopSettingsEditor value={setup.settings} onChange={changeSettings} />
    </main>
  );
}
