import { Env, HealthResponse } from '../types';
import { createRedisClient, checkRedisHealth } from '../services/redis';
import { checkGitHubHealth } from '../services/github';

export async function handleHealth(env: Env): Promise<Response> {
  const redisClient = createRedisClient(env);
  const [redisHealth, githubHealth] = await Promise.all([
    checkRedisHealth(redisClient),
    checkGitHubHealth(env.GITHUB_TOKEN),
  ]);

  const redisOk = redisHealth.status === 'ok' || !redisClient;
  const githubOk = githubHealth.status === 'ok' || !env.GITHUB_TOKEN;
  const isHealthy = redisOk && githubOk;

  const body: HealthResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: '1.0.0',
    checks: {
      redis: redisHealth,
      github_api: githubHealth,
    },
  };

  return new Response(JSON.stringify(body), {
    status: isHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
