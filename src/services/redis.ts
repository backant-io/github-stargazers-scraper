import { Redis } from '@upstash/redis/cloudflare';

export interface RedisHealthStatus {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

export function createRedisClient(env: {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log(
      JSON.stringify({
        level: 'warn',
        message: 'Redis not configured: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN',
      }),
    );
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to create Redis client',
        error: message,
      }),
    );
    return null;
  }
}

export async function checkRedisHealth(client: Redis | null): Promise<RedisHealthStatus> {
  if (!client) {
    return { status: 'error', error: 'Redis client not configured' };
  }

  const start = Date.now();
  try {
    await client.ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Redis health check failed',
        error: message,
      }),
    );
    return { status: 'error', error: message };
  }
}
