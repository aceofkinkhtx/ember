// Photos are shrunk on the phone before they are locked and uploaded. Drawing
// the picture again also drops everything hidden in the file, such as the
// location it was taken and the camera's details.

const MAX_SIDE = 1000;

export class PhotoError extends Error {}

const unreadable = () =>
  new PhotoError(
    "Ember can't open that photo's format on this phone. Try another photo, or a screenshot of it. On iPhone, Settings > Camera > Formats > Most Compatible saves new photos in a format that always works."
  );

export interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/**
 * Opens a photo from the camera or the gallery, the right way up. Uses the
 * fast decoder where it works, and the browser's own image loading where it
 * doesn't (older phones, some gallery formats).
 */
export async function loadImage(file: Blob): Promise<LoadedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Fall through to an <img>.
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw unreadable();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw unreadable();
  }
}

async function toJpeg(canvas: HTMLCanvasElement, quality = 0.8): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw unreadable();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function shrinkPhoto(file: Blob, maxSide = MAX_SIDE): Promise<Uint8Array> {
  const image = await loadImage(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw unreadable();
    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return await toJpeg(canvas);
  } finally {
    image.close();
  }
}

// Cropping to a circle (profile pictures) ----------------------------------------

/** Where the photo sits in a square frame of `frame` px: its top-left corner and scale. */
export interface Placement {
  x: number;
  y: number;
  scale: number;
}

/** The smallest scale at which the photo still covers the whole frame. */
export const coverScale = (w: number, h: number, frame: number) => frame / Math.min(w, h);

/** Keeps the photo covering the frame: no empty edges inside the circle. */
export function clampPlacement(p: Placement, w: number, h: number, frame: number): Placement {
  const scale = Math.max(p.scale, coverScale(w, h, frame));
  const minX = frame - w * scale;
  const minY = frame - h * scale;
  return { scale, x: Math.min(0, Math.max(minX, p.x)), y: Math.min(0, Math.max(minY, p.y)) };
}

/** The photo centred and just covering the frame. */
export function startPlacement(w: number, h: number, frame: number): Placement {
  const scale = coverScale(w, h, frame);
  return { scale, x: (frame - w * scale) / 2, y: (frame - h * scale) / 2 };
}

/** Zooms to `scale`, keeping the point at (cx, cy) in the frame still. */
export function zoomAround(p: Placement, scale: number, cx: number, cy: number, w: number, h: number, frame: number): Placement {
  const s = Math.max(scale, coverScale(w, h, frame));
  const k = s / p.scale;
  return clampPlacement({ scale: s, x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }, w, h, frame);
}

/** The part of the original photo inside the frame. */
export function cropRect(p: Placement, frame: number): { sx: number; sy: number; size: number } {
  return { sx: -p.x / p.scale, sy: -p.y / p.scale, size: frame / p.scale };
}

/** Draws the framed part as a square JPEG of `out` px. */
export async function cropSquare(image: LoadedImage, p: Placement, frame: number, out = 400): Promise<Uint8Array> {
  const { sx, sy, size } = cropRect(p, frame);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw unreadable();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.source, sx, sy, size, size, 0, 0, out, out);
  return toJpeg(canvas, 0.85);
}
