import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from './ratelimit';

function createMockRedis(evalResult: [number, number, number, number]) {
  return {
    eval: vi.fn().mockResolvedValue(evalResult),
  } as unknown as import('@upstash/redis/cloudflare').Redis;
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns allowed when tokens are available', async () => {
    const redis = createMockRedis([1, 99, 1710000000, 0]);
    const result = await checkRateLimit(redis, 'key-123', 'free');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.limit).toBe(100);
    expect(result.resetAt).toBe(1710000000);
    expect(result.retryAfter).toBeUndefined();
  });

  it('returns denied with retryAfter when tokens exhausted', async () => {
    const redis = createMockRedis([0, 0, 1710000000, 36]);
    const result = await checkRateLimit(redis, 'key-123', 'free');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBe(36);
  });

  it('uses correct limit for pro plan', async () => {
    const redis = createMockRedis([1, 999, 1710000000, 0]);
    const result = await checkRateLimit(redis, 'key-456', 'pro');

    expect(result.limit).toBe(1000);
    expect(result.remaining).toBe(999);
  });

  it('uses correct limit for enterprise plan', async () => {
    const redis = createMockRedis([1, 9999, 1710000000, 0]);
    const result = await checkRateLimit(redis, 'key-789', 'enterprise');

    expect(result.limit).toBe(10000);
  });

  it('passes correct arguments to redis eval', async () => {
    const redis = createMockRedis([1, 99, 1710000000, 0]);
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);

    await checkRateLimit(redis, 'key-123', 'free');

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      ['ratelimit:bucket:key-123'],
      [100, 100 / 3600, 1710000000, 3660],
    );
  });

  it('fails open when Redis throws an error', async () => {
    const redis = {
      eval: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
    } as unknown as import('@upstash/redis/cloudflare').Redis;

    const result = await checkRateLimit(redis, 'key-123', 'free');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(-1);
    expect(result.limit).toBe(100);
  });
});
