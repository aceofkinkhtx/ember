import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { feelOptions, photosOf, photoUrl, playTypes, thumbOf, type Thumb, type Toy, type ToyKeyGen } from '../../lib/toys';
import { PhotoGallery } from './PhotoGallery';

// One toy in a grid: its photo (unlocked on this phone) or its first letter.
// Photos with a shared toy open full size in a gallery (Michael, Nov 27).

export function toyTags(toy: Toy): string {
  return [...feelOptions.filter((f) => toy.feel.includes(f.id)), ...playTypes.filter((t) => toy.types.includes(t.id))]
    .map((x) => x.label)
    .join(', ');
}

/** A photo in a square: centred and filling it, or placed where its thumbnail was set. */
export function CroppedImg({ url, thumb }: { url: string; thumb: Thumb | null }) {
  if (!thumb) return <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return (
    <img
      src={url}
      alt=""
      style={{ position: 'absolute', maxWidth: 'none', width: `${thumb.z * 100}%`, height: 'auto', left: `${-thumb.x * 100}%`, top: `${-thumb.y * 100}%` }}
    />
  );
}

export function ToyPhoto({
  toy,
  gens,
  size = '100%',
  photoId,
  thumb
}: {
  toy: Toy;
  gens: ToyKeyGen[];
  size?: string | number;
  photoId?: string;
  /** A thumbnail placement to show instead of the saved one (while editing). */
  thumb?: Thumb | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    photoUrl(toy, gens, photoId)
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [toy.id, toy.photoGen, toy.updatedAt, gens, photoId]);
  const isFirst = photoId === undefined || photoId === photosOf(toy)[0]?.id;
  const placed = thumb !== undefined ? thumb : isFirst ? thumbOf(toy) : null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        width: size,
        aspectRatio: '1',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--line)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--muted)'
      }}
    >
      {url ? <CroppedImg url={url} thumb={placed} /> : (toy.name[0] ?? '?').toUpperCase()}
    </div>
  );
}

/** Unlocks every photo of a toy, in order, for the gallery. */
export function useToyPhotoUrls(toy: Toy | null, gens: ToyKeyGen[], on: boolean): (string | null)[] {
  const ids = toy ? photosOf(toy).map((p) => p.id) : [];
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const key = ids.join(',');
  useEffect(() => {
    if (!toy || !on) return;
    let live = true;
    setUrls(ids.map(() => null));
    ids.forEach((id, i) =>
      photoUrl(toy, gens, id)
        .then((u) => live && setUrls((list) => list.map((x, j) => (j === i ? u : x))))
        .catch(() => undefined)
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toy?.id, toy?.updatedAt, key, gens, on]);
  return urls;
}

function ToyGallery({ toy, gens, onClose }: { toy: Toy; gens: ToyKeyGen[]; onClose: () => void }) {
  const urls = useToyPhotoUrls(toy, gens, true);
  return <PhotoGallery title={toy.name || 'this item'} urls={urls} onClose={onClose} />;
}

export function ToyGrid({ toys, gens, onOpen, below }: { toys: Toy[]; gens: ToyKeyGen[]; onOpen?: (toy: Toy) => void; below?: (toy: Toy) => ReactNode }) {
  const [viewing, setViewing] = useState<Toy | null>(null);
  // Without anything else to open, a toy with photos opens them.
  const open = onOpen ?? ((toy: Toy) => photosOf(toy).length > 0 && setViewing(toy));
  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {toys.map((toy) => {
          const body = (
            <>
              <ToyPhoto toy={toy} gens={gens} />
              <span style={{ fontWeight: 600, display: 'block', marginTop: 6 }}>{toy.name || 'Unnamed item'}</span>
              <span className="note" style={{ display: 'block' }}>
                {toyTags(toy)}
              </span>
            </>
          );
          const clickable = Boolean(onOpen) || photosOf(toy).length > 0;
          const count = photosOf(toy).length;
          return (
            <li key={toy.id}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => open(toy)}
                  style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                  aria-label={`${toy.name || 'Unnamed item'}${toyTags(toy) ? `, ${toyTags(toy)}` : ''}${onOpen ? '' : `. See ${count === 1 ? 'the photo' : `${count} photos`}`}`}
                >
                  {body}
                </button>
              ) : (
                body
              )}
              {below?.(toy)}
            </li>
          );
        })}
      </ul>
      {viewing && <ToyGallery toy={viewing} gens={gens} onClose={() => setViewing(null)} />}
    </>
  );
}
