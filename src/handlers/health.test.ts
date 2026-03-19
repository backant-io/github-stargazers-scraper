import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHealth } from './health';
import type { HealthResponse } from '../types/health';

vi.mock('../services/redis', () => ({
  createRedisClient: vi.fn(),
  checkRedisHealth: vi.fn(),
}));

vi.mock('../services/github', () => ({
  checkGitHubHealth: vi.fn(),
}));

vi.mock('../db', () => ({
  createDatabase: vi.fn(),
  checkDatabaseHealth: vi.fn(),
}));

import { createRedisClient, checkRedisHealth } from '../services/redis';
import { checkGitHubHealth } from '../services/github';
import { createDatabase, checkDatabaseHealth } from '../db';

const mockCreateRedisClient = vi.mocked(createRedisClient);
const mockCheckRedisHealth = vi.mocked(checkRedisHealth);
const mockCheckGitHubHealth = vi.mocked(checkGitHubHealth);
const mockCreateDatabase = vi.mocked(createDatabase);
const mockCheckDatabaseHealth = vi.mocked(checkDatabaseHealth);

function createEnv(overrides: Record<string, unknown> = {}): import('../types').Env {
  return {
    GITHUB_TOKEN: 'test-token',
    UPSTASH_REDIS_REST_URL: 'https://redis.test',
    UPSTASH_REDIS_REST_TOKEN: 'redis-token',
    HYPERDRIVE: { connectionString: 'postgres://test' } as unknown as Hyperdrive,
    ...overrides,
  };
}

describe('handleHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreateRedisClient.mockReturnValue({} as import('@upstash/redis/cloudflare').Redis);
    mockCreateDatabase.mockReturnValue({} as import('../db').Database);
  });

  it('returns 200 with healthy status when all checks pass', async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ status: 'ok', latencyMs: 10 });
    mockCheckRedisHealth.mockResolvedValue({ status: 'ok', latencyMs: 5 });
    mockCheckGitHubHealth.mockResolvedValue({ status: 'ok', latencyMs: 20 });

    const response = await handleHealth(createEnv());
    const body: HealthResponse = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();
    expect(body.response_time_ms).toBeGreaterThanOrEqual(0);
    expect(body.checks).toEqual({
      database: 'ok',
      redis: 'ok',
      github_api: 'ok',
    });
  });

  it('returns 503 with degraded status when one check fails', async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ status: 'ok', latencyMs: 10 });
    mockCheckRedisHealth.mockResolvedValue({
      status: 'error',
      latencyMs: 0,
      error: 'connection refused',
    });
    mockCheckGitHubHealth.mockResolvedValue({ status: 'ok', latencyMs: 20 });

    const response = await handleHealth(createEnv());
    const body: HealthResponse = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.redis).toBe('error');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.github_api).toBe('ok');
  });

  it('returns 503 with unhealthy status when all checks fail', async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ status: 'error', latencyMs: 0, error: 'db down' });
    mockCheckRedisHealth.mockResolvedValue({ status: 'error', latencyMs: 0, error: 'redis down' });
    mockCheckGitHubHealth.mockResolvedValue({
      status: 'error',
      latencyMs: 0,
      error: 'github down',
    });

    const response = await handleHealth(createEnv());
    const body: HealthResponse = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks).toEqual({
      database: 'error',
      redis: 'error',
      github_api: 'error',
    });
  });

  it('handles timeout for slow dependency checks', async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ status: 'ok', latencyMs: 10 });
    mockCheckRedisHealth.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'ok', latencyMs: 5000 }), 5000),
        ),
    );
    mockCheckGitHubHealth.mockResolvedValue({ status: 'ok', latencyMs: 20 });

    const response = await handleHealth(createEnv());
    const body: HealthResponse = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks.redis).toBe('error');
    expect(body.checks.database).toBe('ok');
  }, 5000);

  it('includes Cache-Control no-store header', async () => {
    mockCheckDatabaseHealth.mockResolvedValue({ status: 'ok', latencyMs: 10 });
    mockCheckRedisHealth.mockResolvedValue({ status: 'ok', latencyMs: 5 });
    mockCheckGitHubHealth.mockResolvedValue({ status: 'ok', latencyMs: 20 });

    const response = await handleHealth(createEnv());

    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('runs checks in parallel', async () => {
    const startTime = Date.now();
    const delay = 50;

    mockCheckDatabaseHealth.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'ok', latencyMs: delay }), delay),
        ),
    );
    mockCheckRedisHealth.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'ok', latencyMs: delay }), delay),
        ),
    );
    mockCheckGitHubHealth.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'ok', latencyMs: delay }), delay),
        ),
    );

    await handleHealth(createEnv());
    const elapsed = Date.now() - startTime;

    // If parallel, total time should be much less than 3 * delay
    expect(elapsed).toBeLessThan(delay * 2.5);
  });

  it('handles missing HYPERDRIVE gracefully', async () => {
    mockCheckDatabaseHealth.mockResolvedValue({
      status: 'error',
      latencyMs: 0,
      error: 'Database not configured',
    });
    mockCheckRedisHealth.mockResolvedValue({ status: 'ok', latencyMs: 5 });
    mockCheckGitHubHealth.mockResolvedValue({ status: 'ok', latencyMs: 20 });

    const response = await handleHealth(createEnv({ HYPERDRIVE: undefined }));
    const body: HealthResponse = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks.database).toBe('error');
  });
});
