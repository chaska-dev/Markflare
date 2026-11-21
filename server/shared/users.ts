// Shared validation for accounts. Both backends (server/index.ts and
// functions/api/[[route]].ts) call these so the rules stay identical.

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export type UserValidation<T> = { error: string } | { value: T };

export function validateUsername(v: unknown): UserValidation<string> {
  if (typeof v !== 'string') {
    return { error: 'Username must be 3-32 characters: lowercase letters, digits, dot, dash or underscore' };
  }
  const username = v.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username must be 3-32 characters: lowercase letters, digits, dot, dash or underscore' };
  }
  return { value: username };
}

export function validatePassword(v: unknown): UserValidation<string> {
  if (typeof v !== 'string' || v.length < 8 || v.length > 1024) {
    return { error: 'Password must be between 8 and 1024 characters' };
  }
  return { value: v };
}

export function validateDisplayName(v: unknown, fallback: string): UserValidation<string> {
  const displayName = typeof v === 'string' ? v.trim() : '';
  if (!displayName) return { value: fallback };
  if (displayName.length > 64) {
    return { error: 'Display name must be 64 characters or fewer' };
  }
  return { value: displayName };
}
