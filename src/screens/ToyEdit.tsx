import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chips, TextArea, TextInput } from '../components/intake/Bits';
import { PhotoCropper } from '../components/PhotoCropper';
import { CroppedImg, ToyPhoto, useToyPhotoUrls } from '../components/toys/ToyCard';
import { PhotoGallery } from '../components/toys/PhotoGallery';
import { AccountError, cardFor, listConnections, type Connection } from '../lib/account';
import { PhotoError, shrinkPhoto } from '../lib/photo';
import {
  deleteToy,
  emptyToy,
  feelOptions,
  listMyToys,
  listOptOuts,
  loadToyRing,
  MAX_PHOTOS,
  photosOf,
  photoUrl,
  playTypes,
  thumbOf,
  type Thumb,
  saveToy,
  setOptOut,
  type Toy,
  type ToyDetails
} from '../lib/toys';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { displayName } from './Connections';

// T2: add or edit a toy. Photos (up to six, Michael Nov 26), then how it feels,
// kind of play, name, description, material and notes (Michael, Nov 27), and
// which connections it stays out of scenes with.

export function ToyEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { keys } = useAccount();
  const [toy, setToy] = useState<Toy | null | undefined>(isNew ? null : undefined);
  const [details, setDetails] = useState<ToyDetails>(emptyToy());
  // New photos (with a preview link) and saved photos to remove, both applied on Save.
  const [added, setAdded] = useState<{ key: string; bytes: Uint8Array; url: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  // A new thumbnail placement, for the photo that was first when it was set.
  const [thumb, setThumb] = useState<{ for: string; value: Thumb } | null>(null);
  const [cropping, setCropping] = useState<Blob | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [people, setPeople] = useState<Connection[]>([]);
  const [optedOut, setOptedOut] = useState<string[]>([]);
  const [optedOutBefore, setOptedOutBefore] = useState<string[]>([]);
  /** Connections where the other person marked this "Not for me". */
  const [theyRefused, setTheyRefused] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Two pickers: the camera, and the photo gallery (no capture hint).
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
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
        const mine = outs.filter((o) => o.toyId === id && o.setBy === keys.userId).map((o) => o.connectionId);
        setTheyRefused(outs.filter((o) => o.toyId === id && o.setBy !== keys.userId).map((o) => o.connectionId));
        setOptedOut(mine);
        setOptedOutBefore(mine);
      })
      .catch(() => setToy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, id]);

  const previews = useRef<string[]>([]);
  previews.current = added.map((a) => a.url);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const kept = toy ? photosOf(toy).filter((p) => !removed.includes(p.id)) : [];
  const room = MAX_PHOTOS - kept.length - added.length;
  const firstKey = kept[0] ? `kept:${kept[0].id}` : added[0] ? `new:${added[0].key}` : null;
  const savedThumb = toy && kept[0] && kept[0].id === photosOf(toy)[0]?.id ? thumbOf(toy) : null;
  const firstThumb = thumb && thumb.for === firstKey ? thumb.value : kept[0] ? savedThumb : null;
  const keptUrls = useToyPhotoUrls(toy ?? null, gens, viewing !== null);
  const galleryUrls = [
    ...kept.map((p) => keptUrls[toy ? photosOf(toy).findIndex((x) => x.id === p.id) : -1] ?? null),
    ...added.map((a) => a.url)
  ];

  async function adjustThumb() {
    setError('');
    try {
      if (kept[0] && toy) {
        const url = await photoUrl(toy, gens, kept[0].id);
        if (!url) throw new Error();
        setCropping(await (await fetch(url)).blob());
      } else if (added[0]) setCropping(new Blob([added[0].bytes as BlobPart], { type: 'image/jpeg' }));
    } catch {
      setError("Ember couldn't open that photo. Please try again.");
    }
  }

  async function pickPhotos(files: File[]) {
    if (!files.length) return;
    setError('');
    const fresh: typeof added = [];
    for (const f of files.slice(0, Math.max(0, room))) {
      try {
        let bytes = await shrinkPhoto(f, 1600);
        if (bytes.length > 900_000) bytes = await shrinkPhoto(f);
        fresh.push({ key: crypto.randomUUID(), bytes, url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' })) });
      } catch (e) {
        setError(e instanceof PhotoError ? e.message : "Ember couldn't read that photo. Try another.");
      }
    }
    if (files.length > room) setError(`Up to ${MAX_PHOTOS} photos for each item.`);
    setAdded((a) => [...a, ...fresh]);
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
      const saved = await saveToy(
        keys,
        { id: toy?.id, details: { ...details, photos: toy ? photosOf(toy) : [], photoGen: toy?.photoGen ?? null, thumb: toy?.thumb } },
        { add: added.map((a) => a.bytes), remove: removed, thumb: thumb && thumb.for === firstKey ? thumb.value : undefined }
      );
      for (const c of people) {
        const now = optedOut.includes(c.id);
        if (now !== optedOutBefore.includes(c.id)) await setOptOut(c.id, saved.id, now);
      }
      navigate('/toys', { replace: true });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't save that. Please try again.");
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
      setError(err instanceof AccountError ? err.message : "Ember couldn't delete that.");
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
        <p className="card">That item isn't available.</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <Link to="/toys" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Back
      </Link>
      <h1>{isNew ? 'Add gear' : details.name || 'Edit gear'}</h1>

      <section className="card stack" style={{ gap: 12 }} aria-label="Photos">
        {kept.length + added.length === 0 ? (
          <div
            className="note"
            style={{ width: 160, alignSelf: 'center', aspectRatio: '1', borderRadius: 12, background: 'var(--line)', display: 'grid', placeItems: 'center' }}
          >
            No photo
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {kept.map((p, i) => (
              <li key={p.id || 'first'} className="stack" style={{ gap: 4 }}>
                <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block' }} aria-label={`See photo ${i + 1} full size`} onClick={() => setViewing(i)}>
                  <ToyPhoto toy={toy!} gens={gens} photoId={p.id} thumb={i === 0 ? firstThumb : null} />
                </button>
                {i === 0 && <span className="note" style={{ textAlign: 'center' }}>Main</span>}
                <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove photo ${i + 1}`} onClick={() => setRemoved((r) => [...r, p.id])}>
                  Remove
                </button>
              </li>
            ))}
            {added.map((a, i) => (
              <li key={a.key} className="stack" style={{ gap: 4 }}>
                <button
                  type="button"
                  style={{ all: 'unset', cursor: 'pointer', display: 'block', position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden' }}
                  aria-label={`See new photo ${i + 1} full size`}
                  onClick={() => setViewing(kept.length + i)}
                >
                  <CroppedImg url={a.url} thumb={kept.length === 0 && i === 0 ? firstThumb : null} />
                </button>
                {kept.length === 0 && i === 0 && <span className="note" style={{ textAlign: 'center' }}>Main</span>}
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  aria-label={`Remove photo ${kept.length + i + 1}`}
                  onClick={() => {
                    URL.revokeObjectURL(a.url);
                    setAdded((list) => list.filter((x) => x.key !== a.key));
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {[camera, gallery].map((ref, i) => (
          <input
            key={i}
            ref={ref}
            type="file"
            accept="image/*"
            multiple={i === 1}
            capture={i === 0 ? 'environment' : undefined}
            className="sr-only"
            aria-label={i === 0 ? 'Take a photo' : 'Choose from your photos'}
            tabIndex={-1}
            onChange={(e) => {
              void pickPhotos(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        ))}
        {firstKey && (
          <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'center' }} onClick={() => void adjustThumb()}>
            Adjust the thumbnail
          </button>
        )}
        {room > 0 ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => camera.current?.click()}>
              Take a photo
            </button>
            <button type="button" className="btn btn-outline" onClick={() => gallery.current?.click()}>
              Choose from your photos
            </button>
          </div>
        ) : (
          <p className="note" style={{ margin: 0, textAlign: 'center' }}>
            That's {MAX_PHOTOS} photos, the most for one item.
          </p>
        )}
        <p className="note" style={{ margin: 0, textAlign: 'center' }}>
          Up to {MAX_PHOTOS} photos. They're made smaller, cleared of location and camera details, and locked before they leave your phone.
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
          label="4. Description"
          hint="What it is, in a line or two."
          value={details.description ?? ''}
          rows={2}
          max={500}
          onChange={(description) => setDetails((d) => ({ ...d, description }))}
        />
        <TextInput
          label="5. Material"
          hint="Leather, silicone, hemp, steel..."
          value={details.material ?? ''}
          max={80}
          onChange={(material) => setDetails((d) => ({ ...d, material }))}
        />
        <TextArea
          label="6. Notes"
          hint="Anything worth remembering: size, cleaning, how it lands."
          value={details.notes}
          rows={3}
          max={1000}
          onChange={(notes) => setDetails((d) => ({ ...d, notes }))}
        />
      </section>

      {people.length > 0 && (
        <section className="card stack" style={{ gap: 10 }} aria-label="Keep out of scenes with">
          <label className="field">
            <span className="field-label">Keep out of scenes with</span>
            <span className="field-hint">It won't be suggested or used in scenes with them, and it's hidden from them if you share your gear.</span>
            <select
              className="input"
              value=""
              disabled={people.every((c) => optedOut.includes(c.id))}
              onChange={(e) => e.target.value && setOptedOut((o) => [...o, e.target.value])}
            >
              <option value="">{people.every((c) => optedOut.includes(c.id)) ? 'Everyone is chosen' : 'Choose someone'}</option>
              {people
                .filter((c) => !optedOut.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c)}
                  </option>
                ))}
            </select>
          </label>
          {people
            .filter((c) => optedOut.includes(c.id))
            .map((c) => (
              <div key={c.id} className="person">
                <span>{displayName(c)}</span>
                <button
                  type="button"
                  className="btn btn-quiet"
                  aria-label={`Let ${displayName(c)} see this again`}
                  onClick={() => setOptedOut((o) => o.filter((x) => x !== c.id))}
                >
                  Remove
                </button>
              </div>
            ))}
          {people
            .filter((c) => theyRefused.includes(c.id))
            .map((c) => (
              <p key={`refused-${c.id}`} className="note" style={{ margin: 0 }}>
                {displayName(c)} marked this "Not for me", so it stays out of your scenes together. Only {displayName(c)} can change that.
              </p>
            ))}
        </section>
      )}

      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={save}>
        {busy ? 'Saving...' : 'Save'}
      </button>
      {!isNew && (
        <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={() => setConfirmDelete(true)}>
          Delete
        </button>
      )}

      {cropping && (
        <PhotoCropper
          file={cropping}
          initial={firstThumb}
          onCancel={() => setCropping(null)}
          onPlace={(value) => {
            if (firstKey) setThumb({ for: firstKey, value });
            setCropping(null);
          }}
        />
      )}
      {viewing !== null && <PhotoGallery title={details.name || 'this item'} urls={galleryUrls} start={viewing} onClose={() => setViewing(null)} />}

      {confirmDelete && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="toy-delete-title">
          <div className="sheet">
            <h2 id="toy-delete-title">Delete {details.name || 'this item'}?</h2>
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
