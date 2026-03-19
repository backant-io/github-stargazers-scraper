import { Redis } from '@upstash/redis/cloudflare';
import {
  GitHubRateLimitState,
  GitHubRateLimitCheckResult,
  GITHUB_RATE_LIMIT_CONFIG,
} from '../types/github-ratelimit';

const RATE_LIMIT_KEY = 'github:ratelimit:state';
const RATE_LIMIT_TTL = 3600;

export async function updateGitHubRateLimit(
  redis: Redis,
  state: GitHubRateLimitState,
): Promise<void> {
  await redis.set(RATE_LIMIT_KEY, JSON.stringify(state), { ex: RATE_LIMIT_TTL });
}

export async function getGitHubRateLimitState(redis: Redis): Promise<GitHubRateLimitState | null> {
  const data = await redis.get<string>(RATE_LIMIT_KEY);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function checkGitHubRateLimit(
  redis: Redis,
  hasCachedData: boolean,
): Promise<GitHubRateLimitCheckResult> {
  const state = await getGitHubRateLimitState(redis);

  if (!state) {
    return { action: 'proceed', state: null };
  }

  const now = Date.now();
  const resetTime = new Date(state.resetAt).getTime();

  if (now >= resetTime) {
    return { action: 'proceed', state, warning: 'Rate limit may have reset' };
  }

  if (state.remaining > GITHUB_RATE_LIMIT_CONFIG.approachingThreshold) {
    return { action: 'proceed', state };
  }

  if (state.remaining > GITHUB_RATE_LIMIT_CONFIG.exhaustedThreshold) {
    return {
      action: 'proceed',
      state,
      warning: `GitHub rate limit approaching: ${state.remaining} remaining`,
    };
  }

  const retryAfter = Math.ceil((resetTime - now) / 1000);

  if (hasCachedData) {
    return { action: 'use_cache', state, retryAfter };
  }

  return { action: 'reject', state, retryAfter };
}
