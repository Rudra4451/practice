import 'server-only';
import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/seo/site-url';

export const MAX_RESULT_BODY_BYTES = 512 * 1024; // 512 KiB
export const MAX_SYNC_BODY_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_SMALL_JSON_BODY_BYTES = 16 * 1024; // 16 KiB

function collectAllowedOrigins(request: Request): Set<string> {
  const allowed = new Set<string>();

  let requestProtocol = 'https';
  try {
    const parsedRequestUrl = new URL(request.url);
    allowed.add(parsedRequestUrl.origin);
    requestProtocol = parsedRequestUrl.protocol.replace(/:$/, '') || 'https';
  } catch {
    // Ignore malformed fallback request URL
  }

  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const forwardedProto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    requestProtocol;

  if (forwardedHost) {
    try {
      allowed.add(new URL(`${forwardedProto}://${forwardedHost}`).origin);
    } catch {
      // Ignore malformed forwarded host
    }
  }

  const hostHeader = request.headers.get('host')?.split(',')[0]?.trim();
  if (hostHeader) {
    for (const proto of new Set([requestProtocol, forwardedProto, 'https', 'http'])) {
      try {
        allowed.add(new URL(`${proto}://${hostHeader}`).origin);
      } catch {
        // Ignore malformed host header
      }
    }
  }

  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    allowed.add(getSiteUrl());
  }

  return allowed;
}

/**
 * Enforces same-origin protection for browser-initiated state mutations whenever an `Origin`
 * header is present. Server-to-server / CLI callers omitting `Origin` pass unaffected, while
 * cross-origin browser requests and sandboxed `Origin: null` requests are rejected with `403`.
 */
export function assertSameOriginIfPresent(request: Request): NextResponse | null {
  const rawOrigin = request.headers.get('origin');
  if (rawOrigin === null) {
    return null;
  }

  const trimmed = rawOrigin.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === 'null') {
    return NextResponse.json(
      { error: 'Cross-origin mutation request rejected.' },
      { status: 403 }
    );
  }

  let parsedOrigin: string;
  try {
    parsedOrigin = new URL(trimmed).origin;
  } catch {
    return NextResponse.json(
      { error: 'Cross-origin mutation request rejected.' },
      { status: 403 }
    );
  }

  const allowedOrigins = collectAllowedOrigins(request);
  if (!allowedOrigins.has(parsedOrigin)) {
    return NextResponse.json(
      { error: 'Cross-origin mutation request rejected.' },
      { status: 403 }
    );
  }

  return null;
}

export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Request payload exceeds the ${Math.round(maxBytes / 1024)} KiB limit.` },
          { status: 413 }
        ),
      };
    }
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 }),
    };
  }

  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Request payload exceeds the ${Math.round(maxBytes / 1024)} KiB limit.` },
        { status: 413 }
      ),
    };
  }

  try {
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    if (!rawText.trim()) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 }),
      };
    }
    return { ok: true, data: JSON.parse(rawText) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 }),
    };
  }
}

