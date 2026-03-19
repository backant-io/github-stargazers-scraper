import { CACHE_CONFIG } from '../types/cache';

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
