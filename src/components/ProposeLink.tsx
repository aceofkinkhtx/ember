import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cardFor, listConnections } from '../lib/account';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

/**
 * "Propose a scene": straight to the proposal with your one active connection,
 * or to Connections to choose who, when you have more than one.
 */
export function ProposeLink({ className = 'btn btn-outline', style }: { className?: string; style?: React.CSSProperties }) {
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
  return (
    <Link to={to} className={className} style={style}>
      Propose a scene
    </Link>
  );
}
