// Password hashing with Web Crypto only. No Buffer: Cloudflare Workers does
// not provide it by default.

export const PBKDF2_ITERATIONS = 100000;

const encoder = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromB64(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: BufferSource, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

export interface PasswordRecord {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bytes = await derive(password, salt, PBKDF2_ITERATIONS);
  return { hash: toB64(bytes), salt: toB64(salt), iterations: PBKDF2_ITERATIONS };
}

// Same derivation against the stored salt/iterations. The stored hash is
// decoded and compared byte by byte (XOR accumulation) so the loop never
// exits early on the first difference.
export async function verifyPassword(password: string, stored: PasswordRecord): Promise<boolean> {
  let salt: Uint8Array<ArrayBuffer>;
  let expected: Uint8Array<ArrayBuffer>;
  try {
    salt = fromB64(stored.salt);
    expected = fromB64(stored.hash);
  } catch {
    return false;
  }
  const actual = await derive(password, salt, stored.iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
