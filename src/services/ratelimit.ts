import type { Redis } from '@upstash/redis/cloudflare';
import { RATE_LIMITS, type RateLimitResult } from '../types/ratelimit';
import type { PlanType } from '../types/auth';

const BUCKET_KEY_PREFIX = 'ratelimit:bucket:';
const BUCKET_TTL = 3660; // 1 hour + 1 minute buffer

const TOKEN_BUCKET_SCRIPT = `
local bucket_key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call('HMGET', bucket_key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = max_tokens
  last_refill = now
end

local elapsed = now - last_refill
local refill_amount = elapsed * refill_rate
tokens = math.min(max_tokens, tokens + refill_amount)

local allowed = 0
local retry_after = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry_after = math.ceil((1 - tokens) / refill_rate)
end

local time_to_full = math.ceil((max_tokens - tokens) / refill_rate)
local reset_at = now + time_to_full

redis.call('HMSET', bucket_key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', bucket_key, ttl)

return {allowed, math.floor(tokens), reset_at, retry_after}
`;

export async function checkRateLimit(
  redis: Redis,
  keyId: string,
  planType: PlanType,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[planType];
  const bucketKey = `${BUCKET_KEY_PREFIX}${keyId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    const result = await redis.eval(
      TOKEN_BUCKET_SCRIPT,
      [bucketKey],
      [config.requestsPerHour, config.refillRatePerSecond, nowSeconds, BUCKET_TTL],
    );

    const [allowed, remaining, resetAt, retryAfter] = result as [number, number, number, number];

    return {
      allowed: allowed === 1,
      remaining,
      limit: config.requestsPerHour,
      resetAt,
      retryAfter: allowed === 0 ? retryAfter : undefined,
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'Rate limit check failed, allowing request (fail-open)',
        keyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return {
      allowed: true,
      remaining: -1,
      limit: config.requestsPerHour,
      resetAt: 0,
    };
  }
}
