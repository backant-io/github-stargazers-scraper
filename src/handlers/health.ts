import { Env, HealthResponse } from '../types';
import { createRedisClient, checkRedisHealth } from '../services/redis';
import { checkGitHubHealth } from '../services/github';
import { getGitHubRateLimitState } from '../services/github-ratelimit';
import { GITHUB_RATE_LIMIT_CONFIG } from '../types/github-ratelimit';

export interface GitHubRateLimitHealthStatus {
  status: 'ok' | 'approaching' | 'exhausted';
  remaining?: number;
  limit?: number;
  resetAt?: string;
  resetInSeconds?: number;
}

export async function handleHealth(env: Env): Promise<Response> {
  const redisClient = createRedisClient(env);
  const [redisHealth, githubHealth] = await Promise.all([
    checkRedisHealth(redisClient),
    checkGitHubHealth(env.GITHUB_TOKEN),
  ]);

  let rateLimitStatus: GitHubRateLimitHealthStatus = { status: 'ok' };

  if (redisClient) {
    try {
      const state = await getGitHubRateLimitState(redisClient);
      if (state) {
        if (state.remaining > GITHUB_RATE_LIMIT_CONFIG.approachingThreshold) {
          rateLimitStatus = {
            status: 'ok',
            remaining: state.remaining,
            limit: state.limit,
            resetAt: state.resetAt,
          };
        } else if (state.remaining > GITHUB_RATE_LIMIT_CONFIG.exhaustedThreshold) {
          rateLimitStatus = {
            status: 'approaching',
            remaining: state.remaining,
            limit: state.limit,
            resetAt: state.resetAt,
            resetInSeconds: Math.max(
              0,
              Math.ceil((new Date(state.resetAt).getTime() - Date.now()) / 1000),
            ),
          };
        } else {
          rateLimitStatus = {
            status: 'exhausted',
            remaining: 0,
            limit: state.limit,
            resetAt: state.resetAt,
            resetInSeconds: Math.max(
              0,
              Math.ceil((new Date(state.resetAt).getTime() - Date.now()) / 1000),
            ),
          };
        }
      }
    } catch {
      // If Redis fails, just report ok (no data)
    }
  }

  const redisOk = redisHealth.status === 'ok' || !redisClient;
  const githubOk = githubHealth.status === 'ok' || !env.GITHUB_TOKEN;
  const isHealthy = redisOk && githubOk;

  const body: HealthResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: '1.0.0',
    checks: {
      redis: redisHealth,
      github_api: githubHealth,
      github_rate_limit: rateLimitStatus,
    },
  };

  return new Response(JSON.stringify(body), {
    status: isHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
