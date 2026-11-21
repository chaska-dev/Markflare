// Images that arrive as a URL instead of a file: dragged out of another
// browser tab, or pasted as a plain link. Only http(s) is ever accepted (no
// javascript:, data:, blob:, file:).

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function httpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// Pasted text that is exactly one http(s) link to an image (the query string
// is ignored when checking the extension).
export function imageUrlFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const url = httpUrl(trimmed);
  return url && IMAGE_EXTENSION.test(url.pathname) ? url.href : null;
}

// Pasted text that is exactly one http(s) link, to an image or anything else.
export function webUrlFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return httpUrl(trimmed)?.href ?? null;
}

// Drag types that can carry a web image. Only the type list is readable while
// dragging; the content can be read on drop.
export function hasWebImageTypes(dt: DataTransfer | null | undefined): boolean {
  const types = dt?.types;
  return !!types && (types.includes('text/uri-list') || types.includes('text/html'));
}

// The image URL carried by a drop that has no files. The <img src> in the
// dragged HTML wins; a bare link only counts when it points at an image file,
// so dragging an ordinary link doesn't create an image block.
export function imageUrlFromDrop(dt: DataTransfer | null | undefined): string | null {
  if (!dt || dt.files.length > 0) return null;

  const html = dt.getData('text/html');
  if (html) {
    // DOMParser builds an inert document: nothing loads or runs.
    const src = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src');
    const url = src ? httpUrl(src) : null;
    if (url) return url.href;
  }

  for (const line of dt.getData('text/uri-list').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const url = httpUrl(line);
    if (url && IMAGE_EXTENSION.test(url.pathname)) return url.href;
  }
  return null;
}
