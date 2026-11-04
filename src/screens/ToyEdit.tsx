import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chips, TextArea, TextInput } from '../components/intake/Bits';
import { ToyPhoto } from '../components/toys/ToyCard';
import { AccountError, cardFor, listConnections, type Connection } from '../lib/account';
import { shrinkPhoto } from '../lib/photo';
import {
  deleteToy,
  emptyToy,
  feelOptions,
  listMyToys,
  listOptOuts,
  loadToyRing,
  playTypes,
  saveToy,
  setOptOut,
  type Toy,
  type ToyDetails
} from '../lib/toys';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { displayName } from './Connections';

// T2: add or edit a toy. A photo, then three taps (feel, play type, name),
// notes, and which connections it stays out of scenes with.

export function ToyEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { keys } = useAccount();
  const [toy, setToy] = useState<Toy | null | undefined>(isNew ? null : undefined);
  const [details, setDetails] = useState<ToyDetails>(emptyToy());
  // undefined keeps the current photo, null removes it.
  const [photo, setPhoto] = useState<Uint8Array | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [people, setPeople] = useState<Connection[]>([]);
  const [optedOut, setOptedOut] = useState<string[]>([]);
  const [optedOutBefore, setOptedOutBefore] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const gens = useMemo(() => loadToyRing()?.gens ?? [], [toy]);

  useEffect(() => {
    if (!keys) return;
    listConnections(keys, cardFor(settings.identity))
      .then((all) => setPeople(all.filter((c) => c.status !== 'ended')))
      .catch(() => setPeople([]));
    if (isNew) return;
    Promise.all([listMyToys(keys), listOptOuts()])
      .then(([toys, outs]) => {
        const found = toys.find((t) => t.id === id) ?? null;
        setToy(found);
        if (found) setDetails(found);
        const mine = outs.filter((o) => o.toyId === id).map((o) => o.connectionId);
        setOptedOut(mine);
        setOptedOutBefore(mine);
      })
      .catch(() => setToy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, id]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setError('');
    try {
      const bytes = await shrinkPhoto(f);
      setPhoto(bytes);
      setPreview(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' })));
    } catch {
      setError("Ember couldn't read that photo. Try another.");
    }
  }

  async function save() {
    if (!keys) return;
    if (!details.name.trim()) {
      setError('Give it a name first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await saveToy(keys, { id: toy?.id, details }, photo);
      for (const c of people) {
        const now = optedOut.includes(c.id);
        if (now !== optedOutBefore.includes(c.id)) await setOptOut(c.id, saved.id, now);
      }
      navigate('/toys', { replace: true });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't save that toy. Please try again.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!keys || !toy) return;
    setBusy(true);
    try {
      await deleteToy(keys, toy);
      navigate('/toys', { replace: true });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't delete that toy.");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (toy === undefined) {
    return (
      <main className="screen">
        <p className="note">Loading...</p>
      </main>
    );
  }
  if (!isNew && toy === null) {
    return (
      <main className="screen">
        <Link to="/toys" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Back
        </Link>
        <p className="card">That toy isn't available.</p>
      </main>
    );
  }

  const hasPhoto = photo ? true : photo === null ? false : Boolean(toy && toy.photoGen !== null);

  return (
    <main className="screen">
      <Link to="/toys" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Back
      </Link>
      <h1>{isNew ? 'Add a toy' : details.name || 'Edit toy'}</h1>

      <section className="card stack" style={{ gap: 12 }} aria-label="Photo">
        <div style={{ width: 160, alignSelf: 'center' }}>
          {preview ? (
            <img src={preview} alt="New photo" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} />
          ) : toy && hasPhoto ? (
            <ToyPhoto toy={toy} gens={gens} />
          ) : (
            <div
              className="note"
              style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: 'var(--line)', display: 'grid', placeItems: 'center' }}
            >
              No photo
            </div>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Photo"
          tabIndex={-1}
          onChange={(e) => {
            void pickPhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()}>
            {hasPhoto ? 'New photo' : 'Take or choose a photo'}
          </button>
          {hasPhoto && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setPhoto(null);
                setPreview(null);
              }}
            >
              Remove photo
            </button>
          )}
        </div>
        <p className="note" style={{ margin: 0, textAlign: 'center' }}>
          Photos are made smaller, cleared of location and camera details, and locked before they leave your phone.
        </p>
      </section>

      <section className="card stack" style={{ gap: 16 }}>
        <Chips
          legend="1. How it feels"
          options={feelOptions}
          value={details.feel}
          onChange={(feel) => setDetails((d) => ({ ...d, feel: feel as ToyDetails['feel'] }))}
        />
        <Chips
          legend="2. Kind of play"
          options={playTypes}
          value={details.types}
          onChange={(types) => setDetails((d) => ({ ...d, types: types as ToyDetails['types'] }))}
        />
        <TextInput label="3. Name" value={details.name} max={60} onChange={(name) => setDetails((d) => ({ ...d, name }))} />
        <TextArea
          label="Notes"
          hint="Anything worth remembering: size, material, cleaning, how it lands."
          value={details.notes}
          rows={3}
          max={1000}
          onChange={(notes) => setDetails((d) => ({ ...d, notes }))}
        />
      </section>

      {people.length > 0 && (
        <section className="card stack" style={{ gap: 10 }}>
          <Chips
            legend="Keep out of scenes with"
            hint="It won't be suggested or used in scenes with them, and it's hidden from them if you share your toys."
            options={people.map((c) => ({ id: c.id, label: displayName(c) }))}
            value={optedOut}
            onChange={setOptedOut}
          />
        </section>
      )}

      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={save}>
        {busy ? 'Saving...' : 'Save toy'}
      </button>
      {!isNew && (
        <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => setConfirmDelete(true)}>
          Delete toy
        </button>
      )}

      {confirmDelete && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="toy-delete-title">
          <div className="sheet">
            <h2 id="toy-delete-title">Delete {details.name || 'this toy'}?</h2>
            <p>It's removed from your collection and from anyone you share with. This can't be undone.</p>
            <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={remove}>
              Delete
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
