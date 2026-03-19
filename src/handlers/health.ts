import type { Env } from '../types';
import type { DependencyCheckResult, HealthResponse } from '../types/health';
import { createRedisClient, checkRedisHealth } from '../services/redis';
import { checkGitHubHealth } from '../services/github';
import { createDatabase, checkDatabaseHealth } from '../db';

const VERSION = '1.0.0';
const DEPENDENCY_TIMEOUT_MS = 2000;

export async function handleHealth(env: Env): Promise<Response> {
  const startTime = Date.now();

  const redisClient = createRedisClient(env);
  const db = env.HYPERDRIVE ? createDatabase(env.HYPERDRIVE.connectionString) : null;

  const [dbResult, redisResult, githubResult] = await Promise.allSettled([
    withTimeout(checkDatabaseHealth(db), DEPENDENCY_TIMEOUT_MS, 'database'),
    withTimeout(checkRedisHealth(redisClient), DEPENDENCY_TIMEOUT_MS, 'redis'),
    withTimeout(checkGitHubHealth(env.GITHUB_TOKEN), DEPENDENCY_TIMEOUT_MS, 'github_api'),
  ]);

  const checks = {
    database: extractResult(dbResult, 'database'),
    redis: extractResult(redisResult, 'redis'),
    github_api: extractResult(githubResult, 'github_api'),
  };

  const results = Object.values(checks);
  const allHealthy = results.every((c) => c.status === 'ok');
  const anyHealthy = results.some((c) => c.status === 'ok');
  const overallStatus = allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy';

  const body: HealthResponse = {
    status: overallStatus,
    version: VERSION,
    timestamp: new Date().toISOString(),
    checks: {
      database: checks.database.status,
      redis: checks.redis.status,
      github_api: checks.github_api.status,
    },
    response_time_ms: Date.now() - startTime,
  };

  return new Response(JSON.stringify(body), {
    status: allHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${name} health check timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

function extractResult(
  settledResult: PromiseSettledResult<DependencyCheckResult>,
  name: string,
): DependencyCheckResult {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  }
  return {
    status: 'error',
    latencyMs: 0,
    error: settledResult.reason?.message || `${name} check failed`,
  };
}
