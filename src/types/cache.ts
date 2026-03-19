import type { StargazerListResponse } from './stargazers';

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
}

export interface CacheConfig {
  ttlSeconds: number;
  keyPrefix: string;
  schemaVersion: string;
}

export const CACHE_CONFIG: CacheConfig = {
  ttlSeconds: 86400,
  keyPrefix: 'stargazers',
  schemaVersion: '1.0',
};
