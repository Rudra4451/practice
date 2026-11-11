import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTH_REDIRECT, sanitizeRedirectPath } from '@/lib/security/redirect';

describe('sanitizeRedirectPath', () => {
  it('returns default redirect when input is empty or missing', () => {
    expect(sanitizeRedirectPath(undefined)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath(null)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('   ')).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it('allows valid internal paths with queries and hashes', () => {
    expect(sanitizeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/typing?mode=code&duration=60')).toBe('/typing?mode=code&duration=60');
    expect(sanitizeRedirectPath('/u/rudra_44#history')).toBe('/u/rudra_44#history');
    expect(sanitizeRedirectPath(' /profile ')).toBe('/profile');
  });

  it('rejects external URLs and arbitrary schemes', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('http://evil.com/dashboard')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('javascript:alert(1)')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it('rejects protocol-relative and backslash open-redirect vectors', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('///evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('/\\evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('\\evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it('rejects encoded slash, backslash, and control-character bypass attempts', () => {
    expect(sanitizeRedirectPath('/%2fevil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('/%252fevil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('/%5cevil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('/dashboard\r\nLocation: https://evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeRedirectPath('/dashboard%0d%0aLocation:https://evil.com')).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it('supports custom fallback paths', () => {
    expect(sanitizeRedirectPath('https://evil.com', '/typing')).toBe('/typing');
  });
});

