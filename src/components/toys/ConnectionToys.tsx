import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountError, type Connection } from '../../lib/account';
import {
  listMyToys,
  listOptOuts,
  listToyShares,
  readTheirToys,
  setToyShare,
  theyShareToys,
  type Toy,
  type ToyKeyGen
} from '../../lib/toys';
import { useAccount } from '../../state/account';
import { SettingSwitch } from '../Switch';
import { ToyGrid } from './ToyCard';

// Toys on a connection's page: share your collection with this person, see
// which of your toys stay out of scenes with them, and look at theirs when
// you ask ("Show their toys"), never up front.

export function ConnectionToys({ connection, name }: { connection: Connection; name: string }) {
  const { keys } = useAccount();
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Toy[]>([]);
  const [optOuts, setOptOuts] = useState<string[]>([]);
  const [theyShare, setTheyShare] = useState(false);
  const [theirs, setTheirs] = useState<{ toys: Toy[]; gens: ToyKeyGen[] } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!keys) return;
    Promise.all([listToyShares(keys), listMyToys(keys), listOptOuts(), theyShareToys(keys, connection.otherId)])
      .then(([shares, toys, outs, shared]) => {
        setSharing(shares.includes(connection.otherId));
        setMine(toys);
        setOptOuts(outs.filter((o) => o.connectionId === connection.id).map((o) => o.toyId));
        setTheyShare(shared);
      })
      .catch(() => setSharing(false));
  }, [keys, connection.id, connection.otherId]);

  async function share(on: boolean) {
    if (!keys) return;
    setBusy(true);
    setError('');
    try {
      await setToyShare(keys, connection.otherId, on);
      setSharing(on);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function showTheirs() {
    if (!keys) return;
    setError('');
    setTheirs(undefined);
    try {
      const got = await readTheirToys(keys, connection.otherId);
      // Toys they keep out of scenes with you don't show.
      setTheirs(got && { ...got, toys: got.toys.filter((t) => !optOuts.includes(t.id)) });
    } catch {
      setTheirs(null);
      setError("Ember couldn't load their toys. Please try again.");
    }
  }

  if (sharing === null) return null;
  const kept = mine.filter((t) => optOuts.includes(t.id));

  return (
    <section className="card stack" aria-label="Toys">
      <div className="eyebrow">Toys</div>
      {mine.length ? (
        <div aria-busy={busy}>
          <SettingSwitch
            label={`Share my toys with ${name}`}
            description={
              sharing
                ? 'They can look through your collection when they design a scene with you.'
                : 'Off. Your collection stays private to you.'
            }
            checked={sharing}
            onChange={(on) => void share(on)}
          />
        </div>
      ) : (
        <p className="note" style={{ margin: 0 }}>
          You haven't added any toys. <Link to="/toys/new">Add one</Link> to share it with {name}.
        </p>
      )}
      {kept.length > 0 && (
        <p className="note" style={{ margin: 0 }}>
          Kept out of scenes with {name}: {kept.map((t) => t.name).join(', ')}. Change this on each toy in <Link to="/toys">your toys</Link>.
        </p>
      )}

      {theyShare ? (
        theirs === undefined ? (
          <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => void showTheirs()}>
            Show their toys
          </button>
        ) : theirs && theirs.toys.length ? (
          <>
            <div className="field-label" style={{ fontSize: 16 }}>
              {name}'s toys
            </div>
            <ToyGrid toys={theirs.toys} gens={theirs.gens} />
          </>
        ) : (
          <p className="note" style={{ margin: 0 }}>
            {name} hasn't added any toys yet.
          </p>
        )
      ) : (
        <p className="note" style={{ margin: 0 }}>
          {name} hasn't shared their toys with you.
        </p>
      )}
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
