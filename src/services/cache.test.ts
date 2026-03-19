import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStargazersFromCache, cacheStargazers, invalidateRepoCache } from './cache';
import type { StargazerListResponse } from '../types/stargazers';
import type { CachedStargazerData } from '../types/cache';
import { CACHE_CONFIG } from '../types/cache';

function createMockRedis(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue([0, []]),
    ...overrides,
  } as unknown as import('@upstash/redis/cloudflare').Redis;
}

const mockStargazerResponse: StargazerListResponse = {
  repository: 'facebook/react',
  page: 1,
  per_page: 100,
  total_pages: 10,
  total_stargazers: 1000,
  data: [
    {
      username: 'testuser',
      name: 'Test User',
      email: null,
      company: null,
      location: 'SF',
      bio: 'Developer',
      blog: null,
      twitter_username: null,
      profile_url: 'https://github.com/testuser',
      avatar_url: 'https://avatars.githubusercontent.com/testuser',
      starred_at: '2024-01-01T00:00:00Z',
    },
  ],
  rate_limit: null,
};

describe('getStargazersFromCache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1710000060000); // 60s after cachedAt
  });

  it('returns cache miss when key not found', async () => {
    const redis = createMockRedis();
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.hit).toBe(false);
    expect(result.data).toBeUndefined();
    expect(redis.get).toHaveBeenCalledWith('stargazers:facebook:react:page:1:per_page:100');
  });

  it('returns cache hit with correct data', async () => {
    const cached: CachedStargazerData = {
      data: mockStargazerResponse,
      cachedAt: 1710000000,
      version: CACHE_CONFIG.schemaVersion,
    };

    const redis = createMockRedis({ get: vi.fn().mockResolvedValue(cached) });
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.hit).toBe(true);
    expect(result.data).toEqual(mockStargazerResponse);
    expect(result.cachedAt).toBe(1710000000);
    expect(result.age).toBe(60);
    expect(result.isStale).toBe(false);
    expect(result.shouldRefresh).toBe(false);
  });

  it('returns isStale=true when data is older than TTL', async () => {
    const cachedAt = 1710000060 - 86400; // exactly TTL seconds before mocked now
    const cached: CachedStargazerData = {
      data: mockStargazerResponse,
      cachedAt,
      version: CACHE_CONFIG.schemaVersion,
    };

    const redis = createMockRedis({ get: vi.fn().mockResolvedValue(cached) });
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.hit).toBe(true);
    expect(result.isStale).toBe(true);
    expect(result.shouldRefresh).toBe(true);
  });

  it('returns shouldRefresh=true when data approaches stale threshold', async () => {
    const cachedAt = 1710000060 - 82800; // exactly stale threshold
    const cached: CachedStargazerData = {
      data: mockStargazerResponse,
      cachedAt,
      version: CACHE_CONFIG.schemaVersion,
    };

    const redis = createMockRedis({ get: vi.fn().mockResolvedValue(cached) });
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.hit).toBe(true);
    expect(result.isStale).toBe(false);
    expect(result.shouldRefresh).toBe(true);
  });

  it('returns cache miss for schema version mismatch', async () => {
    const cached: CachedStargazerData = {
      data: mockStargazerResponse,
      cachedAt: 1710000000,
      version: '0.9',
    };

    const redis = createMockRedis({ get: vi.fn().mockResolvedValue(cached) });
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.hit).toBe(false);
  });

  it('returns cache miss on Redis error (graceful degradation)', async () => {
    const redis = createMockRedis({
      get: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.hit).toBe(false);
  });

  it('preserves all profile fields including nulls', async () => {
    const cached: CachedStargazerData = {
      data: mockStargazerResponse,
      cachedAt: 1710000000,
      version: CACHE_CONFIG.schemaVersion,
    };

    const redis = createMockRedis({ get: vi.fn().mockResolvedValue(cached) });
    const result = await getStargazersFromCache(redis, 'facebook', 'react', 1, 100);

    expect(result.data!.data[0].email).toBeNull();
    expect(result.data!.data[0].company).toBeNull();
    expect(result.data!.data[0].blog).toBeNull();
    expect(result.data!.data[0].twitter_username).toBeNull();
  });
});

describe('cacheStargazers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
  });

  it('stores data with correct key and TTL', async () => {
    const redis = createMockRedis();
    await cacheStargazers(redis, 'facebook', 'react', 1, 100, mockStargazerResponse);

    expect(redis.set).toHaveBeenCalledWith(
      'stargazers:facebook:react:page:1:per_page:100',
      expect.any(String),
      { ex: 86400 },
    );
  });

  it('serializes data with cachedAt and version', async () => {
    const redis = createMockRedis();
    await cacheStargazers(redis, 'facebook', 'react', 1, 100, mockStargazerResponse);

    const storedJson = (redis.set as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    const stored = JSON.parse(storedJson) as CachedStargazerData;

    expect(stored.cachedAt).toBe(1710000000);
    expect(stored.version).toBe(CACHE_CONFIG.schemaVersion);
    expect(stored.data).toEqual(mockStargazerResponse);
  });

  it('does not throw on Redis error', async () => {
    const redis = createMockRedis({
      set: vi.fn().mockRejectedValue(new Error('Write failed')),
    });

    await expect(
      cacheStargazers(redis, 'facebook', 'react', 1, 100, mockStargazerResponse),
    ).resolves.not.toThrow();
  });
});

describe('invalidateRepoCache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes all keys matching repo pattern', async () => {
    const redis = createMockRedis({
      scan: vi
        .fn()
        .mockResolvedValue([
          0,
          [
            'stargazers:facebook:react:page:1:per_page:100',
            'stargazers:facebook:react:page:2:per_page:100',
          ],
        ]),
    });

    const count = await invalidateRepoCache(redis, 'facebook', 'react');

    expect(count).toBe(2);
    expect(redis.del).toHaveBeenCalledWith(
      'stargazers:facebook:react:page:1:per_page:100',
      'stargazers:facebook:react:page:2:per_page:100',
    );
  });

  it('returns 0 when no keys found', async () => {
    const redis = createMockRedis();
    const count = await invalidateRepoCache(redis, 'facebook', 'react');

    expect(count).toBe(0);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('returns 0 on Redis error', async () => {
    const redis = createMockRedis({
      scan: vi.fn().mockRejectedValue(new Error('Scan failed')),
    });

    const count = await invalidateRepoCache(redis, 'facebook', 'react');
    expect(count).toBe(0);
  });
});
