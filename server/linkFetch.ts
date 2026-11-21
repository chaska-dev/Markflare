// Local-server transport for link previews (see shared/linkPreview.ts for the
// rules around it). This is an SSRF boundary: the URL comes from a client and
// the request leaves from the machine running the server, which may sit next to
// databases, admin panels or a cloud metadata endpoint.
//
//   1. The hostname is resolved here, and every address it resolves to must be
//      public (shared/ipGuard.ts). One private address among several refuses
//      the host, so a split answer can't smuggle one in.
//   2. The connection is then PINNED to one of the vetted addresses through the
//      socket's `lookup` hook. The request still carries the original hostname
//      (Host header, TLS SNI, certificate check), but never asks DNS again, so a
//      server that answers a second lookup with 127.0.0.1 (DNS rebinding) gets
//      nothing: there is no second lookup between the check and the connect.
//   3. Each redirect hop comes back through here as a new request, so it is
//      validated and resolved like the first one.
//
// What is left: a vetted public address that itself forwards to an internal one
// (a misconfigured reverse proxy; nothing on this machine can see that), and
// NAT64/DNS64 prefixes other than the well-known 64:ff9b::/96 if the host's
// network is set up with a custom one.

import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import { isBlockedAddress } from './shared/ipGuard';
import {
  LinkPreviewError,
  PREVIEW_MAX_BYTES,
  PREVIEW_USER_AGENT,
  PreviewHop,
} from './shared/linkPreview';

interface Vetted {
  address: string;
  family: 4 | 6;
}

// The address to connect to for `hostname` (as in URL.hostname: IPv6 literals
// come with brackets), or a LinkPreviewError when any of its addresses is not
// public. IPv4 is preferred: a vetted IPv6 address may not be routable here.
async function resolvePublic(hostname: string): Promise<Vetted> {
  const literal = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
  const family = net.isIP(literal);
  const addresses = family
    ? [{ address: literal, family }]
    : await dns.promises.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(a => isBlockedAddress(a.address))) {
    throw new LinkPreviewError(400, 'URL not allowed');
  }
  const best = addresses.find(a => a.family === 4) ?? addresses[0];
  return { address: best.address, family: best.family === 6 ? 6 : 4 };
}

// One GET, no redirects followed, at most PREVIEW_MAX_BYTES of body read.
export async function requestOnce(url: URL, signal: AbortSignal): Promise<PreviewHop> {
  const target = await resolvePublic(url.hostname);
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise<PreviewHop>((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          'User-Agent': PREVIEW_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          // Compressed bodies would have to be inflated (and bounded) here.
          'Accept-Encoding': 'identity',
        },
        // Fresh connection every time: nothing pooled may be reused for another
        // hostname, and nothing is left open afterwards.
        agent: false,
        signal,
        // Node 20+ asks for every address ({ all: true }) and wants an array.
        lookup: (_host, options, callback) => {
          if ((options as dns.LookupOptions).all) {
            (callback as any)(null, [{ address: target.address, family: target.family }]);
          } else {
            callback(null, target.address, target.family);
          }
        },
      },
      res => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '');
        const location = typeof res.headers.location === 'string' ? res.headers.location : null;
        // A redirect has nothing worth reading.
        if (status >= 300 && status < 400) {
          res.destroy();
          resolve({ status, contentType, location, body: new Uint8Array(0) });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () => resolve({ status, contentType, location, body: new Uint8Array(Buffer.concat(chunks)) });
        res.on('data', (chunk: Buffer) => {
          const room = PREVIEW_MAX_BYTES - size;
          chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
          size += Math.min(chunk.length, room);
          // Enough: the metadata lives at the top of the document.
          if (size >= PREVIEW_MAX_BYTES) {
            res.destroy();
            finish();
          }
        });
        res.on('end', finish);
        res.on('error', reject);
        // destroy() after the cap was reached resolves first; a stream cut
        // short by the server still gets parsed with what arrived.
        res.on('close', finish);
      },
    );
    req.on('error', reject);
    req.end();
  });
}
