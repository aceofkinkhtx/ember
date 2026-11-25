import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cardFor, listConnections } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

/**
 * Where "Request a scene" goes (formerly "Propose a scene", Michael, Nov 25):
 * straight to the request with your one active connection, or to Connections
 * to choose who, when you have more than one.
 */
export function useProposeTarget(): string {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [to, setTo] = useState('/connections');
  useEffect(() => {
    if (!keys) return;
    listConnections(keys, cardFor(settings.identity))
      .then((all) => {
        const active = all.filter((c) => c.status === 'active');
        setTo(active.length === 1 ? `/connections/${active[0].id}/propose` : '/connections');
      })
      .catch(() => setTo('/connections'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);
  return to;
}

export function ProposeLink({ className = 'btn btn-outline', style }: { className?: string; style?: React.CSSProperties }) {
  const { settings } = useSettings();
  const to = useProposeTarget();
  return (
    <Link to={to} className={className} style={style}>
      Request a {settings.discreet ? 'plan' : 'scene'}
    </Link>
  );
}
