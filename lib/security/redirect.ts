export const DEFAULT_AUTH_REDIRECT = '/dashboard';

const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;
const SCHEME_PREFIX_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Validates and normalizes an internal redirect target, rejecting external hosts,
 * protocol-relative (`//`), backslash (`/` + `\`), double-encoded bypasses, and control chars.
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTH_REDIRECT
): string {
  if (!raw || typeof raw !== 'string') {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) {
    return fallback;
  }

  if (
    CONTROL_CHAR_REGEX.test(trimmed) ||
    SCHEME_PREFIX_REGEX.test(trimmed) ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return fallback;
  }

  // Reject single- or multi-pass percent encodings of `/`, `\`, or control chars.
  let probe = trimmed;
  for (let pass = 0; pass < 3; pass += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(probe);
    } catch {
      return fallback;
    }

    if (
      CONTROL_CHAR_REGEX.test(decoded) ||
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      !decoded.startsWith('/')
    ) {
      return fallback;
    }

    if (decoded === probe) break;
    probe = decoded;
  }

  try {
    const parsed = new URL(trimmed, 'https://typrox.local');
    if (parsed.origin !== 'https://typrox.local') {
      return fallback;
    }

    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!normalized.startsWith('/') || normalized.startsWith('//')) {
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}

