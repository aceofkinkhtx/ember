import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountError, type Connection } from '../../lib/account';
import {
  listMyToys,
  listOptOuts,
  listToyShares,
  readTheirToys,
  setOptOut,
  setToyShare,
  theyShareToys,
  type OptOut,
  type Toy,
  type ToyKeyGen
} from '../../lib/toys';
import { useAccount } from '../../state/account';
import { SettingSwitch } from '../Switch';
import { ToyGrid } from './ToyCard';

// Toys on a connection's page: share your collection with this person, see
// which of your toys stay out of scenes with them, and look at theirs when
// you ask ("Show their gear"), never up front.

export function ConnectionToys({ connection, name }: { connection: Connection; name: string }) {
  const { keys } = useAccount();
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [mine, setMine] = useState<Toy[]>([]);
  /** Opt-outs on this connection: each toy, and who set it. */
  const [outs, setOuts] = useState<OptOut[]>([]);
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
        setOuts(outs.filter((o) => o.connectionId === connection.id));
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
      // Toys they keep out of scenes with you don't show; ones you marked "Not for me" do, so you can change your mind.
      const hidden = outs.filter((o) => o.setBy === connection.otherId).map((o) => o.toyId);
      setTheirs(got && { ...got, toys: got.toys.filter((t) => !hidden.includes(t.id)) });
    } catch {
      setTheirs(null);
      setError("Ember couldn't load their gear. Please try again.");
    }
  }

  async function notForMe(toy: Toy, out: boolean) {
    setError('');
    try {
      await setOptOut(connection.id, toy.id, out);
      setOuts((o) => (out ? [...o, { connectionId: connection.id, toyId: toy.id, setBy: keys!.userId }] : o.filter((x) => !(x.toyId === toy.id && x.setBy === keys!.userId))));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    }
  }

  if (sharing === null) return null;
  const keptByMe = mine.filter((t) => outs.some((o) => o.toyId === t.id && o.setBy === keys?.userId));
  const refusedByThem = mine.filter((t) => outs.some((o) => o.toyId === t.id && o.setBy === connection.otherId));
  const mineNotForMe = (t: Toy) => outs.some((o) => o.toyId === t.id && o.setBy === keys?.userId);

  return (
    <section className="card stack" aria-label="Gear">
      <div className="eyebrow">Gear</div>
      {mine.length ? (
        <div aria-busy={busy}>
          <SettingSwitch
            label={`Share my gear with ${name}`}
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
          You haven't added any gear. <Link to="/toys/new">Add one</Link> to share it with {name}.
        </p>
      )}
      {keptByMe.length > 0 && (
        <p className="note" style={{ margin: 0 }}>
          You keep out of scenes with {name}: {keptByMe.map((t) => t.name).join(', ')}. Change this on each item in <Link to="/toys">your gear</Link>.
        </p>
      )}
      {refusedByThem.length > 0 && (
        <p className="note" style={{ margin: 0 }}>
          {name} marked "Not for me": {refusedByThem.map((t) => t.name).join(', ')}. These stay out of your scenes together, and only {name} can change that.
        </p>
      )}

      {theyShare ? (
        theirs === undefined ? (
          <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => void showTheirs()}>
            Show their gear
          </button>
        ) : theirs && theirs.toys.length ? (
          <>
            <div className="field-label" style={{ fontSize: 16 }}>
              {name}'s gear
            </div>
            <p className="note" style={{ margin: 0 }}>
              Tap "Not for me" on anything you never want used with you. It stays out of every scene with {name} until you change it here.
            </p>
            <ToyGrid
              toys={theirs.toys}
              gens={theirs.gens}
              below={(t) => {
                const out = mineNotForMe(t);
                return (
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={out}
                    style={{ marginTop: 6 }}
                    aria-label={out ? `${t.name}: Not for me. Tap to allow it again` : `Mark ${t.name} Not for me`}
                    onClick={() => void notForMe(t, !out)}
                  >
                    {out ? '✕ Not for me' : 'Not for me'}
                  </button>
                );
              }}
            />
          </>
        ) : (
          <p className="note" style={{ margin: 0 }}>
            {name} hasn't added any gear yet.
          </p>
        )
      ) : (
        <p className="note" style={{ margin: 0 }}>
          {name} hasn't shared their gear with you.
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
