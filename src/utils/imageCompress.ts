// Client-side image optimization, run right before an upload. Phone photos and
// retina screenshots are routinely 5-15 MB; re-encoding them as WebP at a sane
// resolution makes uploads (and every later page view) several times lighter.
//
// This is best-effort: optimizeImage never throws and returns the original file
// whenever anything is unsupported, fails, or doesn't actually save bytes.

const MAX_EDGE = 2560;
// Below this size a file is left alone unless it is oversized in pixels.
const SIZE_THRESHOLD = 1.5 * 1024 * 1024;
// Below this we don't even decode it to look at its dimensions: nothing to win.
const MIN_BYTES_TO_INSPECT = 200 * 1024;
const QUALITY = 0.85;
// Only jpeg/png/webp are touched. GIF would lose its animation, SVG is vector
// and HEIC can't be decoded by most browsers.
const OPTIMIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Surface = OffscreenCanvas | HTMLCanvasElement;

// Animated PNG (acTL chunk) and animated WebP (VP8X animation flag) would be
// flattened to their first frame by a canvas round trip, so skip them.
async function isAnimated(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const ascii = (from: number, len: number) => String.fromCharCode(...head.subarray(from, from + len));
  if (file.type === 'image/webp') {
    return ascii(12, 4) === 'VP8X' && (head[20] & 0x02) !== 0;
  }
  if (file.type === 'image/png') {
    const text = String.fromCharCode(...head);
    const actl = text.indexOf('acTL');
    return actl !== -1 && (text.indexOf('IDAT') === -1 || actl < text.indexOf('IDAT'));
  }
  return false;
}

function createSurface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function encode(surface: Surface, type: string, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in surface) return surface.convertToBlob({ type, quality }).catch(() => null);
  return new Promise(resolve => surface.toBlob(resolve, type, quality));
}

function renameWithExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.${ext}`;
}

export async function optimizeImage(file: File): Promise<File> {
  try {
    if (!OPTIMIZABLE.has(file.type)) return file;
    if (file.size < MIN_BYTES_TO_INSPECT) return file;
    if (typeof createImageBitmap !== 'function') return file;
    if (await isAnimated(file)) return file;

    const bitmap = await createImageBitmap(file);
    try {
      const longEdge = Math.max(bitmap.width, bitmap.height);
      const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
      if (scale === 1 && file.size <= SIZE_THRESHOLD) return file;

      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const surface = createSurface(width, height);
      const ctx = surface.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
      if (!ctx) return file;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);

      // Browsers that can't encode the requested type silently hand back a PNG,
      // so the result type is checked rather than trusted.
      let blob = await encode(surface, 'image/webp', QUALITY);
      let ext = 'webp';
      if (blob?.type !== 'image/webp') {
        // JPEG has no alpha channel; only fall back to it when the source had none.
        if (file.type !== 'image/jpeg') return file;
        blob = await encode(surface, 'image/jpeg', QUALITY);
        ext = 'jpg';
        if (blob?.type !== 'image/jpeg') return file;
      }

      // A PNG is lossless, so only swap it for a lossy file when that clearly pays off.
      const limit = file.type === 'image/png' ? file.size * 0.9 : file.size;
      if (!blob || blob.size >= limit) return file;

      return new File([blob], renameWithExtension(file.name, ext), {
        type: blob.type,
        lastModified: file.lastModified,
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
