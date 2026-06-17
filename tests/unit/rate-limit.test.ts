import { checkRateLimit, type RateLimitState } from '@/lib/rate-limit';

describe('checkRateLimit (fixed window)', () => {
  const opts = { limit: 3, windowMs: 1000 };

  it('allows up to the limit, then blocks', () => {
    const store = new Map<string, RateLimitState>();
    const now = 1_000;
    expect(checkRateLimit(store, 'ip', now, opts).allowed).toBe(true);
    expect(checkRateLimit(store, 'ip', now, opts).allowed).toBe(true);
    expect(checkRateLimit(store, 'ip', now, opts).allowed).toBe(true);
    const blocked = checkRateLimit(store, 'ip', now, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('decrements remaining', () => {
    const store = new Map<string, RateLimitState>();
    expect(checkRateLimit(store, 'ip', 0, opts).remaining).toBe(2);
    expect(checkRateLimit(store, 'ip', 0, opts).remaining).toBe(1);
    expect(checkRateLimit(store, 'ip', 0, opts).remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    const store = new Map<string, RateLimitState>();
    checkRateLimit(store, 'ip', 0, opts);
    checkRateLimit(store, 'ip', 0, opts);
    checkRateLimit(store, 'ip', 0, opts);
    expect(checkRateLimit(store, 'ip', 0, opts).allowed).toBe(false);
    // After the window, the counter resets.
    expect(checkRateLimit(store, 'ip', 1000, opts).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const store = new Map<string, RateLimitState>();
    checkRateLimit(store, 'a', 0, opts);
    checkRateLimit(store, 'a', 0, opts);
    checkRateLimit(store, 'a', 0, opts);
    expect(checkRateLimit(store, 'a', 0, opts).allowed).toBe(false);
    expect(checkRateLimit(store, 'b', 0, opts).allowed).toBe(true);
  });
});
