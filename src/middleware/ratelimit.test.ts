import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRateLimit } from './ratelimit';
import type { AuthContext } from '../types/auth';

vi.mock('../services/ratelimit', () => ({
  checkRateLimit: vi.fn(),
}));

import { checkRateLimit } from '../services/ratelimit';

const mockCheckRateLimit = vi.mocked(checkRateLimit);

describe('applyRateLimit', () => {
  const mockRedis = {} as import('@upstash/redis/cloudflare').Redis;
  const authContext: AuthContext = {
    userId: 'user-1',
    keyId: 'key-1',
    planType: 'free',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns allowed with rate limit info when within limits', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 95,
      limit: 100,
      resetAt: 1710003600,
    });

    const result = await applyRateLimit(mockRedis, authContext);

    expect(result.allowed).toBe(true);
    expect(result.info).toEqual({
      remaining: 95,
      limit: 100,
      resetAt: 1710003600,
    });
    expect(result.retryAfter).toBeUndefined();
  });

  it('returns denied with retryAfter when over limit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 100,
      resetAt: 1710003600,
      retryAfter: 36,
    });

    const result = await applyRateLimit(mockRedis, authContext);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(36);
  });

  it('passes keyId and planType to checkRateLimit', async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 50,
      limit: 1000,
      resetAt: 1710003600,
    });

    await applyRateLimit(mockRedis, {
      userId: 'user-2',
      keyId: 'key-pro',
      planType: 'pro',
    });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(mockRedis, 'key-pro', 'pro');
  });
});
