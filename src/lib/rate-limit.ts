/**
 * Fixed-window in-memory rate limiter.
 *
 * Suitable for a single-instance deployment (this app). Keys combine route
 * and client identity so expensive endpoints (AI calls) are protected even
 * against crafted requests from a single origin.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 5000,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    this.sweep(now);
    const existing = this.windows.get(key);
    const fresh: WindowState = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + this.windowMs };

    if (fresh.count >= this.limit) {
      this.windows.set(key, fresh);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((fresh.resetAt - now) / 1000)),
      };
    }

    fresh.count += 1;
    if (this.windows.size < this.maxKeys) this.windows.set(key, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - fresh.count),
      retryAfterSeconds: 0,
    };
  }

  /** Removes expired windows so the map cannot grow unbounded. */
  private sweep(now: number): void {
    if (this.windows.size === 0) return;
    for (const [key, state] of this.windows) {
      if (state.resetAt <= now) this.windows.delete(key);
    }
  }
}

/**
 * Best-effort client identity from proxy headers. Falls back to "local"
 * (self-hosted / preview usage where the header is absent).
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'local';
  return `${scope}:${ip}`;
}
