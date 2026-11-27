import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Gear photos, full size and uncropped, in a gallery you swipe through
 * (Michael, Nov 27). Each URL is either ready or still unlocking (null).
 */
export function PhotoGallery({ title, urls, start = 0, onClose }: { title: string; urls: (string | null)[]; start?: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(start);

  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    closeBtn.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (i: number) => {
    const el = track.current;
    const n = Math.max(0, Math.min(urls.length - 1, i));
    setAt(n);
    if (el) el.scrollTo?.({ left: n * el.clientWidth, behavior: 'smooth' });
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight') go(at + 1);
    if (e.key === 'ArrowLeft') go(at - 1);
  }

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label={`Photos of ${title}`} onKeyDown={onKeyDown}>
      <div className="gallery-bar">
        <span aria-live="polite">
          {at + 1} of {urls.length}
        </span>
        <button ref={closeBtn} type="button" className="btn btn-outline btn-sm gallery-close" onClick={onClose}>
          Close
        </button>
      </div>
      <div
        ref={track}
        className="gallery-track"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {urls.map((u, i) => (
          <div key={i} className="gallery-slide">
            {u ? <img src={u} alt={`Photo ${i + 1} of ${title}`} /> : <span className="note">Opening...</span>}
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <div className="gallery-nav">
          <button type="button" className="btn btn-outline btn-sm gallery-close" disabled={at === 0} onClick={() => go(at - 1)}>
            ‹ Previous
          </button>
          <button type="button" className="btn btn-outline btn-sm gallery-close" disabled={at === urls.length - 1} onClick={() => go(at + 1)}>
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
