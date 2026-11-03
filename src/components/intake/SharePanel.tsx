import { useEffect, useState } from 'react';
import { AccountError, cardFor, listConnections, type Connection } from '../../lib/account';
import { listShares, setShare, type Scope } from '../../lib/intake';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';
import { Segments } from './Bits';

// BP3: who sees your profile. Per connection: full, essentials only, or not shared.

type Level = 'none' | Scope;

const levels: { id: Level; label: string }[] = [
  { id: 'none', label: 'Not shared' },
  { id: 'essentials', label: 'Essentials' },
  { id: 'full', label: 'Full' }
];

export function SharePanel({ only }: { only?: string }) {
  const { settings } = useSettings();
  const { keys } = useAccount();
  const [people, setPeople] = useState<Connection[] | null>(null);
  const [shares, setShares] = useState<Record<string, Level>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!keys) return;
    Promise.all([listConnections(keys, cardFor(settings.identity)), listShares(keys)])
      .then(([conns, list]) => {
        setPeople(conns.filter((c) => c.status !== 'ended' && c.myRole !== 'top' && (!only || c.otherId === only)));
        setShares(Object.fromEntries(list.map((s) => [s.recipientId, s.scope])));
      })
      .catch(() => setPeople([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, only]);

  if (!keys || people === null) return null;
  if (people.length === 0) {
    return only ? null : <p className="note">Once you connect with a Top, you can choose what they see here.</p>;
  }

  async function change(otherId: string, level: Level) {
    if (!keys) return;
    setBusy(otherId);
    setError('');
    try {
      await setShare(keys, settings.identity, otherId, level === 'none' ? null : level);
      setShares((s) => ({ ...s, [otherId]: level }));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't update sharing. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {people.map((p) => (
        <div key={p.id} aria-busy={busy === p.otherId}>
          <Segments
            label={`What ${p.them?.name || 'this connection'} can see`}
            options={levels}
            value={shares[p.otherId] ?? 'none'}
            onChange={(level) => void change(p.otherId, level)}
          />
        </div>
      ))}
      <p className="note">
        Essentials are your signals, limits, health and safety details, and emergency contact. Taking access away works right away, and anything you save
        afterward stays out of their reach.
      </p>
      {error && <p className="note error" role="alert">{error}</p>}
    </div>
  );
}
