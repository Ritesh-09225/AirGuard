import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '@/lib/rate-limit';
import { TtlCache } from '@/lib/cache';

describe('RateLimiter (fixed window)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to the limit then blocks with retry-after', () => {
    const limiter = new RateLimiter(3, 60_000);
    expect(limiter.check('ip1').allowed).toBe(true);
    expect(limiter.check('ip1').allowed).toBe(true);
    expect(limiter.check('ip1').allowed).toBe(true);
    const blocked = limiter.check('ip1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('resets the window after time passes', () => {
    const limiter = new RateLimiter(2, 10_000);
    limiter.check('ip1');
    limiter.check('ip1');
    expect(limiter.check('ip1').allowed).toBe(false);

    vi.advanceTimersByTime(10_001);
    const after = limiter.check('ip1');
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(1);
  });

  it('tracks keys independently and evicts old windows', () => {
    const limiter = new RateLimiter(1, 5_000);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);

    vi.advanceTimersByTime(6_000);
    limiter.check('a');
    // sweep inside check() should have dropped expired windows
    expect(limiter['windows'].size).toBe(1);
  });
});

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values within the TTL', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    expect(cache.size).toBe(1);
  });

  it('expires values after the TTL', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('k', 'v');
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the oldest entry beyond maxEntries (LRU-ish)', () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // refresh a
    cache.set('c', 3); // evicts b
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('clear() empties everything', () => {
    const cache = new TtlCache<number>(10_000);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
