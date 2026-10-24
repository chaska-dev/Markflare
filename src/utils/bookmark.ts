// Helpers for web bookmark and embed blocks: URLs typed or pasted by the user,
// and the page metadata a bookmark caches in props.preview.

import { BlockProps, BookmarkPreview } from '../types';

function parseHttp(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// What the user typed in the URL field as an http(s) address, or null.
// "example.com/page" gets https://; anything with another scheme
// (javascript:, data:, file:) or without a dotted host is refused.
export function normalizeWebUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = parseHttp(withScheme);
  if (!url || url.username || url.password || !url.hostname.includes('.')) return null;
  return url.href;
}

// The address a bookmark/embed block holds (its content), normalized, or null
// when the content is empty or not an http(s) URL.
export function blockUrl(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  return parseHttp(trimmed)?.href ?? null;
}

// An image or icon address from a stored preview: only absolute http(s).
export function safeHttpUrl(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 2048 ? (parseHttp(value)?.href ?? null) : null;
}

// "example.com/docs/page" for display: no scheme, no www., no trailing slash.
export function displayUrl(url: string): string {
  const parsed = parseHttp(url);
  if (!parsed) return url;
  const host = parsed.hostname.replace(/^www\./, '');
  const rest = `${parsed.pathname}${parsed.search}`.replace(/\/$/, '');
  return `${host}${rest}`;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

// The cached preview of a bookmark, checked and cleaned, or null when there is
// none or it was fetched for another address (the block's URL changed since).
export function readPreview(props: BlockProps | undefined, url: string): BookmarkPreview | null {
  const raw = props?.preview as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object' || raw.url !== url) return null;
  return {
    url,
    title: text(raw.title),
    description: text(raw.description),
    image: safeHttpUrl(raw.image),
    siteName: text(raw.siteName),
    favicon: safeHttpUrl(raw.favicon),
    fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : '',
  };
}

// The link in a paragraph that is nothing but a link: `[text](url)` or a bare
// URL. Used to turn such a paragraph into a bookmark or an embed.
export function linkUrlFromText(content: string): string | null {
  const trimmed = content.trim();
  const md = /^\[[^\]]*\]\((\S+)\)$/.exec(trimmed);
  return blockUrl(md ? md[1] : trimmed);
}

// The paragraph text for a link whose text is its own address: `[url](url)`.
// Parentheses would end the link target early.
export function linkMarkdown(url: string): string {
  const target = url.replace(/[()]/g, c => (c === '(' ? '%28' : '%29'));
  return `[${url.replace(/[\[\]]/g, '')}](${target})`;
}
