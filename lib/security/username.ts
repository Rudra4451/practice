export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const TEMPORARY_USERNAME_PATTERN = /^user_[0-9a-f]{8}(?:_[0-9a-f]{4,8})?$/i;

export const RESERVED_USERNAMES = new Set<string>([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'typrox',
  'api',
  'auth',
  'login',
  'logout',
  'signup',
  'register',
  'dashboard',
  'leaderboard',
  'profile',
  'typing',
  'learn',
  'daily',
  'challenge',
  'challenges',
  'settings',
  'u',
  'null',
  'undefined',
]);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(value));
}

export function isTemporaryGeneratedUsername(value: string | null | undefined): boolean {
  if (!value) return false;
  return TEMPORARY_USERNAME_PATTERN.test(normalizeUsername(value));
}

