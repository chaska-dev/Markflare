// Embed blocks: turn the share URL of a known provider into the URL its iframe
// needs. Only an allowlist of providers is ever embedded; anything else gets no
// iframe at all (the block offers a bookmark instead). Hosts are compared
// exactly after URL parsing, and the iframe address is built from validated
// pieces (ids, user names) rather than copied from the input, so lookalikes such
// as youtube.com.evil.com or evil.com/youtube.com/watch?v=x never match.

export type EmbedProvider = 'youtube' | 'vimeo' | 'loom' | 'figma' | 'googlemaps' | 'codepen' | 'spotify';

export interface EmbedInfo {
  provider: EmbedProvider;
  // Display name, also the iframe title.
  title: string;
  // Always https.
  src: string;
  // CSS aspect-ratio of the frame; ignored when `height` is set.
  aspectRatio: string;
  // Fixed height in px for players that are a strip (Spotify).
  height?: number;
  sandbox: string;
  allow: string;
}

// Providers run their own scripts and read their own storage, so the iframe
// keeps allow-scripts + allow-same-origin: the frame's origin is the provider's
// (never ours), so same-origin only lets it use its own storage. No top
// navigation, forms, modals or downloads. Whether a provider also works without
// allow-same-origin was not verified (no network access), so none drops it.
const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-presentation';

// Where the iframes point, for a Content-Security-Policy `frame-src`. The app
// sets no CSP of its own today; keep this in step with the providers below if
// it ever does.
export const EMBED_FRAME_ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.loom.com',
  'https://www.figma.com',
  'https://www.google.com',
  'https://codepen.io',
  'https://open.spotify.com',
];

function parseWebUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  return url;
}

const segments = (url: URL) => url.pathname.split('/').filter(Boolean);

// "90", "90s", "1m30s", "1h2m3s" -> seconds (youtube's t= / start=).
function parseStartTime(value: string | null): number | null {
  if (!value) return null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i.exec(value.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return seconds > 0 && seconds < 360000 ? seconds : null;
}

const VIDEO_ALLOW = 'fullscreen; picture-in-picture';

function youtube(url: URL): EmbedInfo | null {
  const host = url.hostname;
  const seg = segments(url);
  const ID = /^[A-Za-z0-9_-]{11}$/;
  let src: string | null = null;

  if (host === 'youtu.be') {
    if (seg.length === 1 && ID.test(seg[0])) src = `https://www.youtube-nocookie.com/embed/${seg[0]}`;
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    const v = url.searchParams.get('v');
    const list = url.searchParams.get('list');
    if (seg[0] === 'watch' && seg.length === 1 && v && ID.test(v)) {
      src = `https://www.youtube-nocookie.com/embed/${v}`;
    } else if (['shorts', 'embed', 'live', 'v'].includes(seg[0]) && seg.length === 2 && ID.test(seg[1])) {
      src = `https://www.youtube-nocookie.com/embed/${seg[1]}`;
    } else if (seg[0] === 'playlist' && seg.length === 1 && list && /^[A-Za-z0-9_-]{10,64}$/.test(list)) {
      return {
        provider: 'youtube',
        title: 'YouTube',
        src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`,
        aspectRatio: '16 / 9',
        sandbox: SANDBOX,
        allow: 'encrypted-media; picture-in-picture; fullscreen',
      };
    }
  }
  if (!src) return null;

  const start = parseStartTime(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return {
    provider: 'youtube',
    title: 'YouTube',
    src: start ? `${src}?start=${start}` : src,
    aspectRatio: '16 / 9',
    sandbox: SANDBOX,
    allow: 'encrypted-media; picture-in-picture; fullscreen',
  };
}

function vimeo(url: URL): EmbedInfo | null {
  const seg = segments(url);
  let id: string | undefined;
  let hash: string | undefined;
  if (url.hostname === 'player.vimeo.com') {
    if (seg.length === 2 && seg[0] === 'video' && /^\d+$/.test(seg[1])) {
      id = seg[1];
      hash = url.searchParams.get('h') ?? undefined;
    }
  } else if (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') {
    // /123, /123/<hash> (unlisted), /channels/<name>/123, /groups/<name>/videos/123
    const rest = seg[0] === 'channels' ? seg.slice(2) : seg[0] === 'groups' && seg[2] === 'videos' ? seg.slice(3) : seg;
    if (rest.length >= 1 && rest.length <= 2 && /^\d+$/.test(rest[0])) {
      id = rest[0];
      hash = rest[1] ?? url.searchParams.get('h') ?? undefined;
    }
  }
  if (!id) return null;
  return {
    provider: 'vimeo',
    title: 'Vimeo',
    src: `https://player.vimeo.com/video/${id}${hash && /^[a-f0-9]{6,32}$/i.test(hash) ? `?h=${hash}` : ''}`,
    aspectRatio: '16 / 9',
    sandbox: SANDBOX,
    allow: VIDEO_ALLOW,
  };
}

function loom(url: URL): EmbedInfo | null {
  if (url.hostname !== 'loom.com' && url.hostname !== 'www.loom.com') return null;
  const seg = segments(url);
  if (seg.length !== 2 || (seg[0] !== 'share' && seg[0] !== 'embed') || !/^[a-f0-9]{32}$/i.test(seg[1])) return null;
  return {
    provider: 'loom',
    title: 'Loom',
    src: `https://www.loom.com/embed/${seg[1]}`,
    aspectRatio: '16 / 9',
    sandbox: SANDBOX,
    allow: VIDEO_ALLOW,
  };
}

function figma(url: URL): EmbedInfo | null {
  if (url.hostname !== 'figma.com' && url.hostname !== 'www.figma.com') return null;
  const seg = segments(url);
  if (seg.length < 2 || !['file', 'design', 'proto', 'board'].includes(seg[0])) return null;
  // Figma wants the original link as a parameter, with node-id and the like.
  const original = `https://www.figma.com${url.pathname}${url.search}`;
  return {
    provider: 'figma',
    title: 'Figma',
    src: `https://www.figma.com/embed?embed_host=markflare&url=${encodeURIComponent(original)}`,
    aspectRatio: '16 / 9',
    sandbox: SANDBOX,
    allow: 'fullscreen',
  };
}

// Only Google's own embed addresses (Share > Embed a map): ordinary map links
// refuse to be framed.
function googleMaps(url: URL): EmbedInfo | null {
  if (url.hostname !== 'google.com' && url.hostname !== 'www.google.com') return null;
  if (!/^\/maps\/embed(?:\/[\w-]+)*\/?$/.test(url.pathname) || !url.search) return null;
  return {
    provider: 'googlemaps',
    title: 'Google Maps',
    src: `https://www.google.com${url.pathname}${url.search}`,
    aspectRatio: '16 / 9',
    sandbox: SANDBOX,
    allow: 'fullscreen',
  };
}

function codepen(url: URL): EmbedInfo | null {
  if (url.hostname !== 'codepen.io' && url.hostname !== 'www.codepen.io') return null;
  const seg = segments(url);
  if (seg.length !== 3 || !['pen', 'full', 'details', 'embed'].includes(seg[1])) return null;
  if (!/^[\w-]+$/.test(seg[0]) || !/^[A-Za-z0-9]+$/.test(seg[2])) return null;
  return {
    provider: 'codepen',
    title: 'CodePen',
    src: `https://codepen.io/${seg[0]}/embed/${seg[2]}?default-tab=result`,
    aspectRatio: '16 / 9',
    sandbox: SANDBOX,
    allow: 'fullscreen',
  };
}

function spotify(url: URL): EmbedInfo | null {
  if (url.hostname !== 'open.spotify.com') return null;
  let seg = segments(url);
  // Locale prefix: /intl-es/track/<id>
  if (seg[0] && /^intl-[a-z-]+$/i.test(seg[0])) seg = seg.slice(1);
  if (seg.length !== 2 || !/^[A-Za-z0-9]{10,32}$/.test(seg[1])) return null;
  const heights: Record<string, number> = { track: 152, episode: 232, show: 232, album: 352, playlist: 352, artist: 352 };
  const height = heights[seg[0]];
  if (!height) return null;
  return {
    provider: 'spotify',
    title: 'Spotify',
    src: `https://open.spotify.com/embed/${seg[0]}/${seg[1]}`,
    aspectRatio: '16 / 9',
    height,
    sandbox: SANDBOX,
    allow: 'encrypted-media; fullscreen',
  };
}

const PROVIDERS: ((url: URL) => EmbedInfo | null)[] = [youtube, vimeo, loom, figma, googleMaps, codepen, spotify];

// The iframe description for a URL, or null when it isn't a link of a
// supported provider (including every non-http(s) scheme).
export function embedFromUrl(raw: string): EmbedInfo | null {
  const url = parseWebUrl(raw);
  if (!url) return null;
  for (const provider of PROVIDERS) {
    const info = provider(url);
    if (info) return info;
  }
  return null;
}
