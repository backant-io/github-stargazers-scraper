import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateGitHubRateLimit,
  getGitHubRateLimitState,
  checkGitHubRateLimit,
} from './github-ratelimit';
import type { GitHubRateLimitState } from '../types/github-ratelimit';

function createMockRedis(getResult: string | null = null) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
    set: vi.fn().mockResolvedValue('OK'),
  } as unknown as import('@upstash/redis/cloudflare').Redis;
}

const sampleState: GitHubRateLimitState = {
  remaining: 4500,
  limit: 5000,
  resetAt: new Date(Date.now() + 3600000).toISOString(),
  lastUpdated: Date.now(),
};

describe('updateGitHubRateLimit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('stores rate limit state in Redis with TTL', async () => {
    const redis = createMockRedis();

    await updateGitHubRateLimit(redis, sampleState);

    expect(redis.set).toHaveBeenCalledWith('github:ratelimit:state', JSON.stringify(sampleState), {
      ex: 3600,
    });
  });
});

describe('getGitHubRateLimitState', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no state exists', async () => {
    const redis = createMockRedis(null);

    const result = await getGitHubRateLimitState(redis);

    expect(result).toBeNull();
  });

  it('returns parsed state from Redis string', async () => {
    const redis = createMockRedis(JSON.stringify(sampleState));

    const result = await getGitHubRateLimitState(redis);

    expect(result).toEqual(sampleState);
  });

  it('handles pre-parsed object from Redis', async () => {
    // Upstash sometimes auto-parses JSON
    const redis = {
      get: vi.fn().mockResolvedValue(sampleState),
      set: vi.fn(),
    } as unknown as import('@upstash/redis/cloudflare').Redis;

    const result = await getGitHubRateLimitState(redis);

    expect(result).toEqual(sampleState);
  });
});

describe('checkGitHubRateLimit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns proceed when no state exists', async () => {
    const redis = createMockRedis(null);

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.action).toBe('proceed');
    expect(result.state).toBeNull();
  });

  it('returns proceed when remaining is above threshold', async () => {
    const state: GitHubRateLimitState = {
      remaining: 500,
      limit: 5000,
      resetAt: new Date(Date.now() + 3600000).toISOString(),
      lastUpdated: Date.now(),
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.action).toBe('proceed');
    expect(result.state).toEqual(state);
  });

  it('returns proceed with warning when approaching threshold', async () => {
    const state: GitHubRateLimitState = {
      remaining: 50,
      limit: 5000,
      resetAt: new Date(Date.now() + 3600000).toISOString(),
      lastUpdated: Date.now(),
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.action).toBe('proceed');
    expect(result.warning).toContain('approaching');
    expect(result.warning).toContain('50');
  });

  it('returns reject when exhausted and no cache', async () => {
    const state: GitHubRateLimitState = {
      remaining: 0,
      limit: 5000,
      resetAt: new Date(Date.now() + 1800000).toISOString(),
      lastUpdated: Date.now(),
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.action).toBe('reject');
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(1800);
  });

  it('returns use_cache when exhausted but cache exists', async () => {
    const state: GitHubRateLimitState = {
      remaining: 0,
      limit: 5000,
      resetAt: new Date(Date.now() + 1800000).toISOString(),
      lastUpdated: Date.now(),
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, true);

    expect(result.action).toBe('use_cache');
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('returns proceed when reset time has passed', async () => {
    const state: GitHubRateLimitState = {
      remaining: 0,
      limit: 5000,
      resetAt: new Date(Date.now() - 60000).toISOString(),
      lastUpdated: Date.now() - 120000,
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.action).toBe('proceed');
    expect(result.warning).toContain('reset');
  });

  it('returns proceed at exactly the threshold (100 remaining)', async () => {
    const state: GitHubRateLimitState = {
      remaining: 100,
      limit: 5000,
      resetAt: new Date(Date.now() + 3600000).toISOString(),
      lastUpdated: Date.now(),
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.action).toBe('proceed');
    expect(result.warning).toContain('approaching');
  });

  it('calculates retryAfter correctly', async () => {
    const resetMs = 600000; // 10 minutes
    const state: GitHubRateLimitState = {
      remaining: 0,
      limit: 5000,
      resetAt: new Date(Date.now() + resetMs).toISOString(),
      lastUpdated: Date.now(),
    };
    const redis = createMockRedis(JSON.stringify(state));

    const result = await checkGitHubRateLimit(redis, false);

    expect(result.retryAfter).toBeGreaterThanOrEqual(599);
    expect(result.retryAfter).toBeLessThanOrEqual(601);
  });
});
