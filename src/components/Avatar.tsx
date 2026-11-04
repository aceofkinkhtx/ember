import { useEffect, useRef, useState } from 'react';
import { AccountError, cardFor, refreshMyCards } from '../lib/account';
import { avatarUrl, loadAvatarKey, removeAvatar, setAvatar, type AvatarKey } from '../lib/avatar';
import { shrinkPhoto } from '../lib/photo';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

// A round profile picture, or initials while there isn't one.

export function Avatar({ ownerId, photo, name, size = 44 }: { ownerId: string | null; photo?: AvatarKey | null; name: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (ownerId && photo) void avatarUrl(ownerId, photo).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [ownerId, photo?.v, photo?.key]);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  const style = { width: size, height: size, borderRadius: '50%', flex: 'none' as const };
  return url ? (
    <img src={url} alt="" style={{ ...style, objectFit: 'cover' }} />
  ) : (
    <span
      aria-hidden="true"
      style={{ ...style, display: 'grid', placeItems: 'center', background: 'var(--surface-sunk)', color: 'var(--text)', fontWeight: 700, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/** Me: set, change or remove your own picture. */
export function AvatarEditor() {
  const { keys, status } = useAccount();
  const { settings } = useSettings();
  const [photo, setPhoto] = useState(loadAvatarKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);

  if (status !== 'signed-in' || !keys) return null;

  async function run(task: () => Promise<AvatarKey | null>) {
    setBusy(true);
    setError('');
    try {
      setPhoto(await task());
      // Your connections get the new key with your card.
      await refreshMyCards(keys!, cardFor(settings.identity));
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't use that picture. Try another.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" style={{ gap: 12 }} aria-label="Profile picture">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar ownerId={keys.userId} photo={photo} name={settings.identity.name} size={72} />
        <div className="stack" style={{ gap: 6 }}>
          <span className="card-title" style={{ margin: 0 }}>
            Profile picture
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => file.current?.click()}>
              {photo ? 'Change' : 'Add a picture'}
            </button>
            {photo && (
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void run(async () => (await removeAvatar(keys), null))}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Profile picture"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void run(async () => setAvatar(keys, await shrinkPhoto(f, 400)));
        }}
      />
      <p className="note" style={{ margin: 0 }}>
        Only your connections see it. It's made smaller, cleared of location and camera details, and locked before it leaves your phone. It doesn't have to be your face.
      </p>
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
