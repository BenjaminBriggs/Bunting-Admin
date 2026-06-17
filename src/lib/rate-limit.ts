/**
 * Minimal in-process fixed-window rate limiter.
 *
 * Adequate for a single internal-team deployment. NOTE: state is per-instance
 * (per Node/edge isolate) — with multiple instances behind a load balancer the
 * effective limit is N×, and counters reset on restart. For strict global
 * limits, back this with a shared store (Redis) instead.
 */

export interface RateLimitState {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  store: Map<string, RateLimitState>,
  key: string,
  now: number,
  opts: RateLimitOptions
): RateLimitResult {
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + opts.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.limit - 1, resetAt };
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: opts.limit - existing.count, resetAt: existing.resetAt };
}
