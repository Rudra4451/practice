import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertSameOriginIfPresent,
  readJsonBodyWithLimit,
} from '@/lib/security/http';

describe('lib/security/http', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows missing Origin, matching Origin, and trusted forwarded host Origin, while rejecting cross-origin and null Origins', () => {
    const noOrigin = new Request('http://localhost:3000/api/results', { method: 'POST' });
    expect(assertSameOriginIfPresent(noOrigin)).toBeNull();

    const sameOrigin = new Request('http://localhost:3000/api/results', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(assertSameOriginIfPresent(sameOrigin)).toBeNull();

    const forwardedOrigin = new Request('http://127.0.0.1:3000/api/results', {
      method: 'POST',
      headers: {
        origin: 'https://typrox.example',
        'x-forwarded-host': 'typrox.example',
        'x-forwarded-proto': 'https',
      },
    });
    expect(assertSameOriginIfPresent(forwardedOrigin)).toBeNull();

    const nullOrigin = new Request('http://localhost:3000/api/results', {
      method: 'POST',
      headers: { origin: 'null' },
    });
    expect(assertSameOriginIfPresent(nullOrigin)?.status).toBe(403);

    const evilOrigin = new Request('http://localhost:3000/api/results', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    expect(assertSameOriginIfPresent(evilOrigin)?.status).toBe(403);
  });

  it('rejects oversized payloads with 413 for both Content-Length and undeclared bodies', async () => {
    const oversizedDeclared = new Request('http://localhost:3000/api/challenges', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '20000',
      },
      body: JSON.stringify({ testResultId: 'ok' }),
    });
    const declaredRes = await readJsonBodyWithLimit(oversizedDeclared, 16 * 1024);
    expect(declaredRes.ok).toBe(false);
    if (!declaredRes.ok) {
      expect(declaredRes.response.status).toBe(413);
    }

    const hugePayload = JSON.stringify({ pad: 'a'.repeat(20 * 1024) });
    const undeclared = new Request('http://localhost:3000/api/challenges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: hugePayload,
    });
    const actualRes = await readJsonBodyWithLimit(undeclared, 16 * 1024);
    expect(actualRes.ok).toBe(false);
    if (!actualRes.ok) {
      expect(actualRes.response.status).toBe(413);
    }
  });
});

