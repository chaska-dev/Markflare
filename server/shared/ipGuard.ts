// Which hosts the link-preview fetcher may talk to. Pure string logic (no node:
// or Workers APIs) shared by both backends: it only decides, the caller does
// the DNS lookup and the request.
//
// The rule is "public unicast only": anything loopback, private, link-local,
// shared (CGNAT), multicast, reserved or documentation is refused, in every
// textual form an address can take.

// inet_aton style IPv4: 1-4 parts, each decimal, 0x hex or leading-0 octal, the
// last part filling the remaining bytes ("127.1", "0x7f000001", "2130706433").
// URL parsing already normalizes these to dotted decimal, but the guard does not
// rely on its caller having gone through a URL. null when it is not one.
export function parseIPv4(text: string): number | null {
  const parts = text.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(part)) n = parseInt(part.slice(2), 16);
    else if (/^0[0-7]+$/.test(part)) n = parseInt(part, 8);
    else if (/^(0|[1-9][0-9]*)$/.test(part)) n = parseInt(part, 10);
    else return null;
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  const last = nums.pop()!;
  // Every part before the last is one byte; the last one takes what is left.
  if (nums.some(n => n > 255) || last >= 256 ** (4 - nums.length)) return null;
  let value = last;
  nums.forEach((n, i) => { value += n * 256 ** (3 - i); });
  return value;
}

// An IPv6 address as eight 16-bit groups, or null. Accepts "::" compression, a
// dotted IPv4 tail ("::ffff:127.0.0.1"), brackets and a %zone suffix.
export function parseIPv6(text: string): number[] | null {
  let s = text.trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  if (!s.includes(':')) return null;

  // A dotted tail stands for the last two groups.
  const tail = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (tail) {
    const v4 = parseIPv4(tail[2]);
    if (v4 === null) return null;
    s = `${tail[1]}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const out: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !rest) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - rest.length;
  // "::" must stand for at least one group.
  if (fill < 1) return null;
  return [...head, ...Array<number>(fill).fill(0), ...rest];
}

// Is the IPv4 address (as a 32-bit number) one a server must not connect to?
function blockedIPv4(v: number): boolean {
  const a = Math.floor(v / 2 ** 24);
  const b = Math.floor(v / 2 ** 16) % 256;
  const c = Math.floor(v / 2 ** 8) % 256;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // documentation
  if (a === 192 && b === 88 && c === 99) return true; // 6to4 relay anycast
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // documentation
  if (a === 203 && b === 0 && c === 113) return true; // documentation
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function blockedIPv6(g: number[]): boolean {
  const embedded = (hi: number, lo: number) => blockedIPv4(hi * 65536 + lo);
  const firstFive = g.slice(0, 5).every(x => x === 0);
  // ::ffff:a.b.c.d (IPv4-mapped): the embedded IPv4 decides.
  if (firstFive && g[5] === 0xffff) return embedded(g[6], g[7]);
  // Anything else in ::/8 is ::, ::1 or the long-deprecated IPv4-compatible form.
  if (g[0] < 0x100) {
    // 64:ff9b::/96 (NAT64) carries an IPv4 address in the last 32 bits.
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) return embedded(g[6], g[7]);
    return true;
  }
  // 2002::/16 (6to4) carries the IPv4 address in groups 1-2.
  if (g[0] === 0x2002) return embedded(g[1], g[2]);
  // Global unicast is 2000::/3; fc00::/7, fe80::/10, ff00::/8 and the rest of
  // the space are not public.
  if ((g[0] & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

// true when `address` is an IP literal (any notation) that is not a public
// unicast address, and also when it cannot be parsed at all: unknown means no.
export function isBlockedAddress(address: string): boolean {
  const text = address.trim();
  const v6 = parseIPv6(text);
  if (v6) return blockedIPv6(v6);
  const v4 = parseIPv4(text);
  if (v4 !== null) return blockedIPv4(v4);
  return true;
}

// Does the hostname look like an IP literal? (Hosts of a parsed URL keep IPv6
// literals in brackets.)
export function isIpLiteral(host: string): boolean {
  const h = host.trim();
  if (h.startsWith('[') || h.includes(':')) return parseIPv6(h) !== null;
  return parseIPv4(h) !== null;
}

// Names that are never public, whatever they resolve to. Single-label hosts
// ("intranet") are refused too: they only resolve through a search domain.
const PRIVATE_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.intranet', '.lan', '.home.arpa', '.corp'];

// true for a hostname that must not be fetched without even looking it up.
// IP literals are checked as addresses; names by suffix.
export function isBlockedHostname(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.+$/, '');
  if (h === '') return true;
  if (isIpLiteral(h)) return isBlockedAddress(h);
  if (!h.includes('.')) return true;
  return h === 'localhost' || PRIVATE_SUFFIXES.some(s => h.endsWith(s));
}
