import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listVersions } from '../lib/intake';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

/**
 * After someone requests, builds or sends a scene (Michael, Nov 25): a nudge
 * to fill out their intake, shown only while they haven't. As the bottom
 * that's their intake (profile); as the Top it's their offerings, which is
 * what Ember designs from on their side.
 */
export function IntakeReminder({ role }: { role: 'top' | 'bottom' }) {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [missing, setMissing] = useState(false);
  const topDone = Boolean(settings.top.offerings.setAt);
  useEffect(() => {
    if (role !== 'bottom' || !keys) return;
    let live = true;
    listVersions(keys)
      .then((v) => live && setMissing(v.length === 0))
      .catch(() => live && setMissing(false));
    return () => {
      live = false;
    };
  }, [role, keys]);

  if (role === 'top') {
    if (topDone) return null;
    return (
      <section className="box box-info stack" style={{ gap: 8 }} aria-label="Your offerings">
        <strong>One more thing: tell Ember what you offer.</strong>
        <span>Your offerings and ranges shape every design and keep each scene within what you do.</span>
        <Link to="/me/offerings" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
          Your offerings
        </Link>
      </section>
    );
  }
  if (!missing) return null;
  return (
    <section className="box box-info stack" style={{ gap: 8 }} aria-label="Your intake">
      <strong>One more thing: fill out your intake.</strong>
      <span>Your limits, body notes and signals then go with every scene, so your Top can plan around them.</span>
      <Link to="/profile" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
        Fill out my intake
      </Link>
    </section>
  );
}
