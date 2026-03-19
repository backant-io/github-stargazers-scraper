import type { Redis } from '@upstash/redis/cloudflare';
import {
  buildStargazerCacheKey,
  buildRepoCachePattern,
  isStale,
  shouldProactiveRefresh,
} from '../utils/cache';
import type { CachedStargazerData, CacheResult } from '../types/cache';
import { CACHE_CONFIG } from '../types/cache';
import type { StargazerListResponse } from '../types/stargazers';

export async function getStargazersFromCache(
  redis: Redis,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): Promise<CacheResult<StargazerListResponse>> {
  try {
    const key = buildStargazerCacheKey(owner, repo, page, perPage);
    const cached = await redis.get<CachedStargazerData>(key);

    if (!cached) {
      return { hit: false };
    }

    if (cached.version !== CACHE_CONFIG.schemaVersion) {
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'Cache schema mismatch, treating as miss',
          key,
          cachedVersion: cached.version,
          expectedVersion: CACHE_CONFIG.schemaVersion,
        }),
      );
      return { hit: false };
    }

    const age = Math.floor(Date.now() / 1000) - cached.cachedAt;
    const dataIsStale = isStale(cached.cachedAt, CACHE_CONFIG.ttlSeconds);
    const needsRefresh = dataIsStale || shouldProactiveRefresh(cached.cachedAt);

    return {
      hit: true,
      data: cached.data,
      cachedAt: cached.cachedAt,
      age,
      isStale: dataIsStale,
      shouldRefresh: needsRefresh,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Cache read error, treating as miss',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return { hit: false };
  }
}

export async function cacheStargazers(
  redis: Redis,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
  data: StargazerListResponse,
): Promise<void> {
  try {
    const key = buildStargazerCacheKey(owner, repo, page, perPage);

    const cacheEntry: CachedStargazerData = {
      data,
      cachedAt: Math.floor(Date.now() / 1000),
      version: CACHE_CONFIG.schemaVersion,
    };

    await redis.set(key, JSON.stringify(cacheEntry), {
      ex: CACHE_CONFIG.ttlSeconds,
    });

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Cached stargazer data',
        key,
        ttl: CACHE_CONFIG.ttlSeconds,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Cache write error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
  }
}

export async function invalidateRepoCache(
  redis: Redis,
  owner: string,
  repo: string,
): Promise<number> {
  try {
    const pattern = buildRepoCachePattern(owner, repo);
    const keys: string[] = [];
    let cursor: string | number = 0;

    do {
      const result: [string, string[]] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } while (String(cursor) !== '0');

    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Invalidated cache',
        pattern,
        keysDeleted: keys.length,
      }),
    );
    return keys.length;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Cache invalidation error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return 0;
  }
}
