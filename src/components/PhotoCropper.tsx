import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampPlacement, coverScale, cropSquare, loadImage, PhotoError, startPlacement, zoomAround, type LoadedImage, type Placement } from '../lib/photo';

// Placing a profile picture in its circle: drag to move, pinch or use the
// slider to zoom. Only the part inside the circle is kept.

const FRAME = 280;
const MAX_ZOOM = 4;

export function PhotoCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (bytes: Uint8Array) => Promise<void> }) {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [place, setPlace] = useState<Placement | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    let loaded: LoadedImage | null = null;
    const objectUrl = URL.createObjectURL(file);
    loadImage(file).then(
      (img) => {
        loaded = img;
        if (!live) return img.close();
        setImage(img);
        setUrl(objectUrl);
        setPlace(startPlacement(img.width, img.height, FRAME));
      },
      (e) => live && setError(e instanceof PhotoError ? e.message : "Ember couldn't open that photo. Try another.")
    );
    return () => {
      live = false;
      loaded?.close();
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const w = image?.width ?? 1;
  const h = image?.height ?? 1;
  const minScale = coverScale(w, h, FRAME);
  const zoom = place ? place.scale / minScale : 1;

  const move = (dx: number, dy: number) => setPlace((p) => (p ? clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, w, h, FRAME) : p));
  const zoomTo = (z: number, cx = FRAME / 2, cy = FRAME / 2) =>
    setPlace((p) => (p ? zoomAround(p, Math.min(MAX_ZOOM, Math.max(1, z)) * minScale, cx, cy, w, h, FRAME) : p));

  const zoomBy = (d: number) =>
    setPlace((p) => (p ? zoomAround(p, Math.min(MAX_ZOOM, Math.max(1, p.scale / minScale + d)) * minScale, FRAME / 2, FRAME / 2, w, h, FRAME) : p));

  const local = (e: PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2 && place) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: zoom };
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 1) move(now.x - prev.x, now.y - prev.y);
    else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo((pinch.current.scale * dist) / pinch.current.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => move(step, 0),
      ArrowRight: () => move(-step, 0),
      ArrowUp: () => move(0, step),
      ArrowDown: () => move(0, -step),
      '+': () => zoomBy(0.2),
      '=': () => zoomBy(0.2),
      '-': () => zoomBy(-0.2)
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  }

  async function save() {
    if (!image || !place) return;
    setBusy(true);
    setError('');
    try {
      await onDone(await cropSquare(image, place, FRAME));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Ember couldn't use that picture. Try another.");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="sheet stack" style={{ gap: 14, alignItems: 'center', maxHeight: '92vh', overflowY: 'auto' }}>
        <h2 id="crop-title" style={{ margin: 0, alignSelf: 'flex-start' }}>
          Place your picture
        </h2>
        {error && !image ? (
          <p className="note error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        ) : (
          <>
            <p className="note" style={{ margin: 0, alignSelf: 'flex-start' }}>
              Drag to move it. Pinch or use the slider to zoom. Only what's inside the circle is kept.
            </p>
            <div
              ref={stage}
              className="cropper"
              tabIndex={0}
              role="img"
              aria-label="Your picture in its circle. Use the arrow keys to move it, and plus or minus to zoom."
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            >
              {url && place ? (
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  style={{ width: w * place.scale, height: h * place.scale, transform: `translate(${place.x}px, ${place.y}px)` }}
                />
              ) : (
                <span className="note">Opening...</span>
              )}
              <span className="cropper-ring" aria-hidden="true" />
            </div>
            <label className="field" style={{ width: FRAME }}>
              <span className="field-label">Zoom</span>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                disabled={!place}
                onChange={(e) => zoomTo(Number(e.target.value))}
              />
            </label>
            {error && (
              <p className="note error" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            )}
          </>
        )}
        <button type="button" className="btn btn-primary btn-block" disabled={!place || busy} onClick={() => void save()}>
          {busy ? 'Saving...' : 'Use this picture'}
        </button>
        <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
