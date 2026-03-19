import { describe, it, expect } from 'vitest';
import { buildStargazerCacheKey, buildRepoCachePattern } from './cache';

describe('buildStargazerCacheKey', () => {
  it('builds correct cache key', () => {
    const key = buildStargazerCacheKey('facebook', 'react', 1, 100);
    expect(key).toBe('stargazers:facebook:react:page:1:per_page:100');
  });

  it('normalizes owner and repo to lowercase', () => {
    const key = buildStargazerCacheKey('Facebook', 'React', 1, 100);
    expect(key).toBe('stargazers:facebook:react:page:1:per_page:100');
  });

  it('produces different keys for different pages', () => {
    const key1 = buildStargazerCacheKey('owner', 'repo', 1, 100);
    const key2 = buildStargazerCacheKey('owner', 'repo', 2, 100);
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different per_page values', () => {
    const key1 = buildStargazerCacheKey('owner', 'repo', 1, 50);
    const key2 = buildStargazerCacheKey('owner', 'repo', 1, 100);
    expect(key1).not.toBe(key2);
  });

  it('produces consistent keys regardless of case', () => {
    const key1 = buildStargazerCacheKey('OWNER', 'REPO', 1, 100);
    const key2 = buildStargazerCacheKey('owner', 'repo', 1, 100);
    expect(key1).toBe(key2);
  });
});

describe('buildRepoCachePattern', () => {
  it('builds correct wildcard pattern', () => {
    const pattern = buildRepoCachePattern('facebook', 'react');
    expect(pattern).toBe('stargazers:facebook:react:*');
  });

  it('normalizes to lowercase', () => {
    const pattern = buildRepoCachePattern('Facebook', 'React');
    expect(pattern).toBe('stargazers:facebook:react:*');
  });
});
