import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ToyGrid } from '../components/toys/ToyCard';
import { tabLabel } from '../content/copy';
import { feelOptions, listMyToys, loadToyRing, playTypes, type Toy } from '../lib/toys';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

// T1: the toy directory. Anyone can keep one; Tops have it as a tab, and
// bottoms reach it from their profile.

export function Toys() {
  const { settings } = useSettings();
  const { keys, status } = useAccount();
  const navigate = useNavigate();
  const [toys, setToys] = useState<Toy[] | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const gens = useMemo(() => loadToyRing()?.gens ?? [], [toys]);

  useEffect(() => {
    if (!keys) return;
    listMyToys(keys)
      .then(setToys)
      .catch(() => {
        setToys([]);
        setError("Ember couldn't load your toys. Check your connection and try again.");
      });
  }, [keys]);

  const title = settings.activeRole === 'top' ? tabLabel('toys', settings.discreet) : settings.discreet ? 'My items' : 'My toys';

  if (status !== 'signed-in') {
    return (
      <main className="screen">
        <h1>{title}</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>Sign in to keep your toys. They're locked on your phone before they're saved, photos too.</p>
          <Link to="/connections" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const options = [...feelOptions, ...playTypes];
  const shown = (toys ?? []).filter((t) => filters.every((f) => (t.feel as string[]).includes(f) || (t.types as string[]).includes(f)));

  return (
    <main className="screen">
      <div className="person">
        <h1 style={{ margin: 0 }}>{title}</h1>
        <Link to="/toys/new" className="btn btn-primary">
          Add
        </Link>
      </div>

      {toys === null ? (
        <p className="note">Loading...</p>
      ) : toys.length === 0 ? (
        <div className="card stack">
          <div className="card-title">Add your first toy</div>
          <p className="setting-desc" style={{ margin: 0 }}>
            A photo and three taps: how it feels, what kind of play, and a name. You choose who sees your collection, connection by
            connection.
          </p>
          <Link to="/toys/new" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Add a toy
          </Link>
        </div>
      ) : (
        <>
          <div className="chips" role="group" aria-label="Filter">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="chip"
                aria-pressed={filters.includes(o.id)}
                onClick={() => setFilters((f) => (f.includes(o.id) ? f.filter((x) => x !== o.id) : [...f, o.id]))}
              >
                {o.label}
              </button>
            ))}
          </div>
          {shown.length ? (
            <ToyGrid toys={shown} gens={gens} onOpen={(t) => navigate(`/toys/${t.id}`)} />
          ) : (
            <p className="note">No toys match those filters.</p>
          )}
          <p className="note">
            Share your collection with a connection from their page in Connections. You can also keep any toy out of scenes with one
            person.
          </p>
        </>
      )}
      {error && <p className="note error" role="alert">{error}</p>}
    </main>
  );
}
