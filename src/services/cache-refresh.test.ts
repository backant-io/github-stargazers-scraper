import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireRefreshLock, releaseRefreshLock } from './cache-refresh';

function createMockRedis(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue([0, []]),
    ...overrides,
  } as unknown as import('@upstash/redis/cloudflare').Redis;
}

describe('acquireRefreshLock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
  });

  it('returns true when lock is acquired (SETNX succeeds)', async () => {
    const redis = createMockRedis({ set: vi.fn().mockResolvedValue('OK') });
    const result = await acquireRefreshLock(redis, 'facebook', 'react', 1, 100);

    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'refresh_lock:facebook:react:page:1:per_page:100',
      '1710000000000',
      { nx: true, ex: 60 },
    );
  });

  it('returns false when lock already exists (SETNX returns null)', async () => {
    const redis = createMockRedis({ set: vi.fn().mockResolvedValue(null) });
    const result = await acquireRefreshLock(redis, 'facebook', 'react', 1, 100);

    expect(result).toBe(false);
  });

  it('returns false on Redis error (fail open)', async () => {
    const redis = createMockRedis({
      set: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const result = await acquireRefreshLock(redis, 'facebook', 'react', 1, 100);

    expect(result).toBe(false);
  });

  it('normalizes owner and repo to lowercase in lock key', async () => {
    const redis = createMockRedis({ set: vi.fn().mockResolvedValue('OK') });
    await acquireRefreshLock(redis, 'Facebook', 'React', 1, 100);

    expect(redis.set).toHaveBeenCalledWith(
      'refresh_lock:facebook:react:page:1:per_page:100',
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe('releaseRefreshLock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the lock key', async () => {
    const redis = createMockRedis();
    await releaseRefreshLock(redis, 'facebook', 'react', 1, 100);

    expect(redis.del).toHaveBeenCalledWith('refresh_lock:facebook:react:page:1:per_page:100');
  });

  it('does not throw on Redis error', async () => {
    const redis = createMockRedis({
      del: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });

    await expect(releaseRefreshLock(redis, 'facebook', 'react', 1, 100)).resolves.not.toThrow();
  });
});
