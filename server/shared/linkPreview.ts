// Link previews for bookmark blocks: validate the URL, follow redirects safely
// and pull the page metadata (title, description, image, site name, icon) out
// of its HTML. Pure logic shared by both backends: the transport is injected
// (`requestOnce`), so Express can pin the connection to a vetted IP and the
// Workers backend can use fetch, with the same rules around them. HTML is parsed
// with plain string/regex scanning because Workers have no DOM.

import { isBlockedHostname } from './ipGuard';

export interface LinkPreview {
  // The page's address after redirects.
  url: string;
  title: string | null;
  description: string | null;
  // Absolute http(s) URLs only.
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

export const PREVIEW_TIMEOUT_MS = 5000;
export const PREVIEW_MAX_BYTES = 512 * 1024;
export const PREVIEW_MAX_REDIRECTS = 3;
export const PREVIEW_USER_AGENT = 'Markflare-LinkPreview/1.0';

// Limits of what ends up in the block's props (4096 characters in total, see
// blockProps.ts), so a preview always fits next to the other props.
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 300;
const MAX_SITE_NAME = 100;
const MAX_URL = 500;
const MAX_INPUT_URL = 2048;

export class LinkPreviewError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'LinkPreviewError';
    this.status = status;
  }
}

// What the transport hands back for one request.
export interface PreviewHop {
  status: number;
  contentType: string;
  // Location header of a redirect.
  location: string | null;
  // At most PREVIEW_MAX_BYTES of the body.
  body: Uint8Array;
}

// Only plain http(s) on the default ports, without credentials, to a host that
// is not private or local. Ports other than 80/443 are refused on purpose: a
// preview has no reason to reach a service on 6379 or 9200, and allowing any
// port would turn the endpoint into a port scanner.
export function parsePreviewUrl(raw: string): URL {
  const text = raw.trim();
  if (!text || text.length > MAX_INPUT_URL) throw new LinkPreviewError(400, 'Invalid URL');
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new LinkPreviewError(400, 'Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new LinkPreviewError(400, 'Only http and https URLs are supported');
  if (url.username || url.password) throw new LinkPreviewError(400, 'URL not allowed');
  if (url.port !== '' && url.port !== '80' && url.port !== '443') throw new LinkPreviewError(400, 'URL not allowed');
  if (isBlockedHostname(url.hostname)) throw new LinkPreviewError(400, 'URL not allowed');
  return url;
}

// An image/icon reference from the page, as an absolute http(s) URL, or null.
// The browser (not the server) loads these, so literal private addresses and
// local names are dropped here, as a page could otherwise make every viewer's
// browser poke at their own network.
function publicAssetUrl(value: string | undefined, base: string): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim(), base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || isBlockedHostname(url.hostname)) return null;
  return url.href.length <= MAX_URL ? url.href : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·',
  bull: '•', copy: '©', reg: '®', trade: '™', times: '×',
};

// Basic HTML entities, in one pass (so "&amp;lt;" ends up as "&lt;", not "<").
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      // Controls, surrogates and out-of-range values are not text.
      if (!Number.isFinite(code) || code < 32 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return ' ';
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

// Entities decoded, one line, bounded; null when nothing is left.
function cleanText(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const text = decodeHtmlEntities(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

// ASCII-only lowercase: indexes stay the same as in the original string.
const asciiLower = (s: string) => s.replace(/[A-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 32));

// The start tags named `name` ("meta", "link"), as the text between "<name" and
// the closing ">". Scans by hand instead of with a regex: quotes in a malformed
// tag make a regex backtrack quadratically or worse, and the page is untrusted.
// A quote only opens a value right after "=", as in HTML. Tags over MAX_TAG are
// skipped, and an unterminated one ends the scan.
const MAX_TAG = 8192;
function startTags(html: string, lower: string, name: string): string[] {
  const out: string[] = [];
  const open = '<' + name;
  let pos = 0;
  for (;;) {
    const start = lower.indexOf(open, pos);
    if (start === -1) return out;
    const from = start + open.length;
    // "<metadata" is not "<meta".
    if (!/[\s\/>]/.test(lower[from] ?? '')) {
      pos = from;
      continue;
    }
    let quote = '';
    let prev = '';
    let end = -1;
    for (let i = from; i < html.length; i++) {
      const c = html[i];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '>') {
        end = i;
        break;
      } else if ((c === '"' || c === "'") && prev === '=') {
        quote = c;
      }
      if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') prev = c;
    }
    if (end === -1) return out;
    if (end - from <= MAX_TAG) out.push(html.slice(from, end));
    pos = end + 1;
  }
}

// Remove everything from `open` to `close` (case-insensitive, linear time). An
// unterminated section swallows the rest, like a browser would.
function removeSections(html: string, open: string, close: string): string {
  const lower = asciiLower(html);
  let out = '';
  let pos = 0;
  for (;;) {
    const start = lower.indexOf(open, pos);
    if (start === -1) return out + html.slice(pos);
    out += html.slice(pos, start);
    const end = lower.indexOf(close, start + open.length);
    if (end === -1) return out;
    pos = end + close.length;
  }
}

const ATTRIBUTE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+)))?/g;

// Attributes of a tag as lower-cased name -> raw value (entities not decoded).
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTRIBUTE.exec(tag))) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

// Metadata of an HTML page. `baseUrl` is where the page was fetched from, to
// resolve relative image/icon addresses. Open Graph wins over Twitter cards,
// which win over the plain <title> / meta description.
export function parseLinkPreview(html: string, baseUrl: string): LinkPreview {
  let doc = removeSections(html, '<!--', '-->');
  doc = removeSections(doc, '<script', '</script>');
  doc = removeSections(doc, '<style', '</style>');
  const headEnd = doc.search(/<\/head\s*>/i);
  const head = headEnd === -1 ? doc : doc.slice(0, headEnd);

  const lower = asciiLower(head);

  const meta: Record<string, string> = {};
  for (const tag of startTags(head, lower, 'meta')) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? '').trim().toLowerCase();
    if (key && attrs.content !== undefined && !(key in meta)) meta[key] = attrs.content;
  }

  const links = startTags(head, lower, 'link').map(parseAttributes);
  const iconHref = (match: (rel: string[]) => boolean) =>
    links.find(a => a.href && match((a.rel ?? '').toLowerCase().split(/\s+/)))?.href;
  const icon = iconHref(rel => rel.includes('icon')) ?? iconHref(rel => rel.includes('apple-touch-icon'));

  // Markup inside <title> (rare, but it happens) is not part of the text.
  let titleTag: string | undefined;
  const titleStart = lower.indexOf('<title');
  if (titleStart !== -1) {
    const contentStart = lower.indexOf('>', titleStart);
    const contentEnd = contentStart === -1 ? -1 : lower.indexOf('</title', contentStart);
    if (contentEnd !== -1) titleTag = head.slice(contentStart + 1, contentEnd).replace(/<[^>]*>/g, '');
  }

  // The first candidate that survives cleaning, so an empty og:title still
  // falls back to the next source.
  const text = (max: number, ...candidates: (string | undefined)[]) => {
    for (const c of candidates) {
      const cleaned = cleanText(c, max);
      if (cleaned) return cleaned;
    }
    return null;
  };
  const asset = (...candidates: (string | undefined)[]) => {
    for (const c of candidates) {
      const url = publicAssetUrl(c, baseUrl);
      if (url) return url;
    }
    return null;
  };

  return {
    url: new URL(baseUrl).href,
    title: text(MAX_TITLE, meta['og:title'], meta['twitter:title'], titleTag),
    description: text(MAX_DESCRIPTION, meta['og:description'], meta['twitter:description'], meta.description),
    image: asset(meta['og:image:secure_url'], meta['og:image'], meta['og:image:url'], meta['twitter:image'], meta['twitter:image:src']),
    siteName: text(MAX_SITE_NAME, meta['og:site_name'], meta['application-name']),
    favicon: asset(icon, '/favicon.ico'),
  };
}

// Text of a response body. The charset comes from the header or, failing that,
// a <meta charset> in the first bytes; anything unknown is read as UTF-8.
export function decodeHtmlBody(bytes: Uint8Array, contentType: string): string {
  let label = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType)?.[1];
  if (!label) {
    const sniff = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
    label = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(sniff)?.[1];
  }
  try {
    return new TextDecoder(label || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Fetch `raw` and extract its preview. `requestOnce` performs ONE request,
// without following redirects, and must not read more than PREVIEW_MAX_BYTES; it
// is called again for every hop, after the new address has been validated like
// the first one (a redirect to 127.0.0.1 must not get through). The whole chain
// shares one deadline, signalled through `signal`. Throws LinkPreviewError.
export async function fetchLinkPreview(
  raw: string,
  requestOnce: (url: URL, signal: AbortSignal) => Promise<PreviewHop>,
): Promise<LinkPreview> {
  let url = parsePreviewUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  // Rejects at the deadline even if the transport is stuck somewhere that
  // ignores the signal (a DNS lookup, say).
  const deadline = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('deadline')), { once: true });
  });
  try {
    for (let hop = 0; hop <= PREVIEW_MAX_REDIRECTS; hop++) {
      let res: PreviewHop;
      try {
        res = await Promise.race([requestOnce(url, controller.signal), deadline]);
      } catch (e) {
        if (e instanceof LinkPreviewError) throw e;
        if (controller.signal.aborted) throw new LinkPreviewError(504, 'The page took too long to answer');
        throw new LinkPreviewError(502, 'Could not reach that page');
      }

      if (REDIRECT_STATUSES.has(res.status)) {
        try {
          if (!res.location) throw new Error('missing Location');
          url = parsePreviewUrl(new URL(res.location, url).href);
        } catch {
          throw new LinkPreviewError(502, 'The page redirects somewhere that is not allowed');
        }
        continue;
      }
      if (res.status < 200 || res.status >= 300) throw new LinkPreviewError(502, `The page answered ${res.status}`);

      // Images, PDFs and the like have no markup to read: just the address.
      const type = res.contentType.split(';')[0].trim().toLowerCase();
      if (type && type !== 'text/html' && type !== 'application/xhtml+xml') {
        return { url: url.href, title: null, description: null, image: null, siteName: null, favicon: null };
      }
      return parseLinkPreview(decodeHtmlBody(res.body, res.contentType), url.href);
    }
    throw new LinkPreviewError(502, 'Too many redirects');
  } finally {
    clearTimeout(timer);
  }
}
