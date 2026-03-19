import type { Redis } from '@upstash/redis/cloudflare';
import { checkRateLimit } from '../services/ratelimit';
import type { AuthContext } from '../types/auth';
import type { RateLimitInfo } from '../types/ratelimit';

export interface RateLimitCheckResult {
  allowed: boolean;
  info: RateLimitInfo;
  retryAfter?: number;
}

export async function applyRateLimit(
  redis: Redis,
  authContext: AuthContext,
): Promise<RateLimitCheckResult> {
  const result = await checkRateLimit(redis, authContext.keyId, authContext.planType);

  return {
    allowed: result.allowed,
    info: {
      remaining: result.remaining,
      limit: result.limit,
      resetAt: result.resetAt,
    },
    retryAfter: result.retryAfter,
  };
}
