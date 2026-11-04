import { useEffect, useState } from 'react';
import { feelOptions, photoUrl, playTypes, type Toy, type ToyKeyGen } from '../../lib/toys';

// One toy in a grid: its photo (unlocked on this phone) or its first letter.

export function toyTags(toy: Toy): string {
  return [...feelOptions.filter((f) => toy.feel.includes(f.id)), ...playTypes.filter((t) => toy.types.includes(t.id))]
    .map((x) => x.label)
    .join(', ');
}

export function ToyPhoto({ toy, gens, size = '100%' }: { toy: Toy; gens: ToyKeyGen[]; size?: string | number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    photoUrl(toy, gens)
      .then((u) => live && setUrl(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [toy.id, toy.photoGen, toy.updatedAt, gens]);

  return (
    <div
      aria-hidden="true"
      style={{
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
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (toy.name[0] ?? '?').toUpperCase()}
    </div>
  );
}

export function ToyGrid({ toys, gens, onOpen }: { toys: Toy[]; gens: ToyKeyGen[]; onOpen?: (toy: Toy) => void }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {toys.map((toy) => {
        const body = (
          <>
            <ToyPhoto toy={toy} gens={gens} />
            <span style={{ fontWeight: 600, display: 'block', marginTop: 6 }}>{toy.name || 'Unnamed toy'}</span>
            <span className="note" style={{ display: 'block' }}>
              {toyTags(toy)}
            </span>
          </>
        );
        return (
          <li key={toy.id}>
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(toy)}
                style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                aria-label={`${toy.name || 'Unnamed toy'}${toyTags(toy) ? `, ${toyTags(toy)}` : ''}`}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
