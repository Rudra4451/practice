/**
 * Sliding Window In-Memory Rate Limiter (Phase 4 Security Audit)
 * Prevents API request floods and denial of service attacks.
 */

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private static store: Map<string, RateLimitRecord> = new Map();

  public static check(
    identifier: string,
    limit = 60,       // Max requests
    windowMs = 60000  // Sliding window (1 min)
  ): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const record = this.store.get(identifier) || { timestamps: [] };

    // Filter timestamps within sliding window
    const validTimestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= limit) {
      const oldest = validTimestamps[0];
      const resetMs = windowMs - (now - oldest);
      return { allowed: false, remaining: 0, resetMs };
    }

    validTimestamps.push(now);
    this.store.set(identifier, { timestamps: validTimestamps });

    return {
      allowed: true,
      remaining: limit - validTimestamps.length,
      resetMs: windowMs,
    };
  }
}
