import type { Redis } from '@upstash/redis/cloudflare';
import { buildRefreshLockKey } from '../utils/cache';
import { CACHE_CONFIG } from '../types/cache';
import { cacheStargazers } from './cache';
import { getStargazers } from './stargazers';
import type { Env } from '../types';

export async function acquireRefreshLock(
  redis: Redis,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): Promise<boolean> {
  try {
    const lockKey = buildRefreshLockKey(owner, repo, page, perPage);
    const result = await redis.set(lockKey, Date.now().toString(), {
      nx: true,
      ex: CACHE_CONFIG.refreshLockTtlSeconds,
    });
    return result === 'OK';
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to acquire refresh lock',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return false;
  }
}

export async function releaseRefreshLock(
  redis: Redis,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): Promise<void> {
  try {
    const lockKey = buildRefreshLockKey(owner, repo, page, perPage);
    await redis.del(lockKey);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to release refresh lock',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
  }
}

export function triggerBackgroundRefresh(
  redis: Redis,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
  env: Env,
  ctx: ExecutionContext,
): void {
  ctx.waitUntil(executeBackgroundRefresh(redis, owner, repo, page, perPage, env));
}

async function executeBackgroundRefresh(
  redis: Redis,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
  env: Env,
): Promise<void> {
  const lockAcquired = await acquireRefreshLock(redis, owner, repo, page, perPage);

  if (!lockAcquired) {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Background refresh already in progress',
        owner,
        repo,
        page,
        perPage,
      }),
    );
    return;
  }

  try {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Starting background refresh',
        owner,
        repo,
        page,
        perPage,
      }),
    );

    const startTime = Date.now();
    const result = await getStargazers(
      env.GITHUB_TOKEN!,
      owner,
      repo,
      page,
      perPage,
      startTime,
      redis,
    );

    await cacheStargazers(redis, owner, repo, page, perPage, result);

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Background refresh completed',
        owner,
        repo,
        page,
        perPage,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Background refresh failed',
        owner,
        repo,
        page,
        perPage,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
  } finally {
    await releaseRefreshLock(redis, owner, repo, page, perPage);
  }
}
