import type { StargazerListResponse } from './stargazers';

export type CacheStatus = 'HIT' | 'MISS';

export interface CacheHeaderInfo {
  status: CacheStatus;
  age?: number;
}

export interface CachedStargazerData {
  data: StargazerListResponse;
  cachedAt: number;
  version: string;
}

export interface CacheResult<T> {
  hit: boolean;
  data?: T;
  cachedAt?: number;
  age?: number;
  isStale?: boolean;
  shouldRefresh?: boolean;
}

export interface CacheConfig {
  ttlSeconds: number;
  staleThresholdSeconds: number;
  refreshLockTtlSeconds: number;
  keyPrefix: string;
  schemaVersion: string;
}

export const CACHE_CONFIG: CacheConfig = {
  ttlSeconds: 86400,
  staleThresholdSeconds: 82800,
  refreshLockTtlSeconds: 60,
  keyPrefix: 'stargazers',
  schemaVersion: '1.0',
};
