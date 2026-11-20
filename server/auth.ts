// Auth helpers for the local Express server. Replicates the exact logic of
// [[route]].ts (sha256 + base64 + timing-safe compare) so tokens generated
// by either backend are interchangeable during development.

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const LOGIN_RATE_WINDOW_MS = 60 * 1000; // 1-minute window
const LOGIN_RATE_MAX = 5; // max 5 attempts / min / IP

export interface AuthEnv {
  username: string;
  password: string;
  secret: string;
}

export function loadAuthEnv(): AuthEnv | null {
  // Precedence:
  // 1. process.env (exported from the shell)
  // 2. .env
  // 3. .dev.vars (wrangler format: KEY=VALUE per line, no quotes)
  const env = process.env;
  let username = env.AUTH_USERNAME;
  let password = env.AUTH_PASSWORD;
  let secret = env.AUTH_SECRET;
  if (username && password && secret) return { username, password, secret };

  for (const file of ['.env', '.dev.vars']) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      let v = vRaw.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k === 'AUTH_USERNAME') username = v;
      if (k === 'AUTH_PASSWORD') password = v;
      if (k === 'AUTH_SECRET') secret = v;
    }
    if (username && password && secret) return { username, password, secret };
  }
  return null;
}

export async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Constant-time comparison: prevents timing attacks on the bearer token and
// on the credentials. Both inputs must be the same length.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function issueToken(
  username: string,
  secret: string,
  ttlMs: number = TOKEN_TTL_MS,
  tokenId?: string
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlMs;
  const payload = tokenId ? `${username}:${expiresAt}:api:${tokenId}` : `${username}:${expiresAt}`;
  const sig = await sha256Hex(`${payload}:${secret}`);
  // token = base64(payload).sig
  const b64 = Buffer.from(payload, 'utf8').toString('base64');
  return { token: `${b64}.${sig}`, expiresAt };
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ ok: boolean; expired?: boolean; username?: string; isApi?: boolean; tokenId?: string }> {
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return { ok: false };
  const b64 = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return { ok: false };
  }
  const expectedSig = await sha256Hex(`${payload}:${secret}`);
  if (!timingSafeEqual(sig, expectedSig)) return { ok: false };
  const parts = payload.split(':');
  if (parts.length < 2) return { ok: false };
  const username = parts[0];
  if (!username) return { ok: false };
  const expStr = parts[1];
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return { ok: false };
  if (Date.now() >= exp) return { ok: false, expired: true };
  const isApi = parts[2] === 'api';
  const tokenId = isApi ? parts[3] : undefined;
  return { ok: true, username, isApi, tokenId };
}

// In-memory per-IP rate limit. Workers (Cloudflare) don't share state across
// isolates; in local Node it's trivial — one Map per instance.
const loginAttempts = new Map<string, number[]>();

export function checkRate(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - LOGIN_RATE_WINDOW_MS;
  const arr = (loginAttempts.get(ip) || []).filter(t => t > windowStart);
  if (arr.length >= LOGIN_RATE_MAX) {
    loginAttempts.set(ip, arr);
    return false;
  }
  arr.push(now);
  loginAttempts.set(ip, arr);
  return true;
}

export function clientIp(req: any): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
