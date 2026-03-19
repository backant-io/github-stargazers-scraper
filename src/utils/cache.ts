import { CACHE_CONFIG } from '../types/cache';

const REFRESH_LOCK_PREFIX = 'refresh_lock';

export function buildStargazerCacheKey(
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): string {
  const normalizedOwner = owner.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  return `${CACHE_CONFIG.keyPrefix}:${normalizedOwner}:${normalizedRepo}:page:${page}:per_page:${perPage}`;
}

export function buildRepoCachePattern(owner: string, repo: string): string {
  const normalizedOwner = owner.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  return `${CACHE_CONFIG.keyPrefix}:${normalizedOwner}:${normalizedRepo}:*`;
}

export function buildRefreshLockKey(
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): string {
  const normalizedOwner = owner.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  return `${REFRESH_LOCK_PREFIX}:${normalizedOwner}:${normalizedRepo}:page:${page}:per_page:${perPage}`;
}

export function isStale(cachedAt: number, ttlSeconds: number = CACHE_CONFIG.ttlSeconds): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - cachedAt;
  return age >= ttlSeconds;
}

export function shouldProactiveRefresh(
  cachedAt: number,
  staleThreshold: number = CACHE_CONFIG.staleThresholdSeconds,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = now - cachedAt;
  return age >= staleThreshold;
}

export function getCacheAge(cachedAt: number): number {
  return Math.floor(Date.now() / 1000) - cachedAt;
}
