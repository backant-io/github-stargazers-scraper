import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStargazerCacheKey,
  buildRepoCachePattern,
  buildRefreshLockKey,
  isStale,
  shouldProactiveRefresh,
  getCacheAge,
  shouldBypassCache,
} from './cache';

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

describe('buildRefreshLockKey', () => {
  it('builds correct lock key', () => {
    const key = buildRefreshLockKey('facebook', 'react', 1, 100);
    expect(key).toBe('refresh_lock:facebook:react:page:1:per_page:100');
  });

  it('normalizes to lowercase', () => {
    const key = buildRefreshLockKey('Facebook', 'React', 1, 100);
    expect(key).toBe('refresh_lock:facebook:react:page:1:per_page:100');
  });

  it('produces different keys for different pages', () => {
    const key1 = buildRefreshLockKey('owner', 'repo', 1, 100);
    const key2 = buildRefreshLockKey('owner', 'repo', 2, 100);
    expect(key1).not.toBe(key2);
  });
});

describe('isStale', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for fresh data (age < TTL)', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 3600; // 1 hour ago
    expect(isStale(cachedAt, 86400)).toBe(false);
  });

  it('returns true for data at exactly TTL age', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 86400; // exactly 24 hours
    expect(isStale(cachedAt, 86400)).toBe(true);
  });

  it('returns true for data older than TTL', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 90000; // 25 hours
    expect(isStale(cachedAt, 86400)).toBe(true);
  });

  it('returns false for data just under TTL', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 86399; // 1 second under 24 hours
    expect(isStale(cachedAt, 86400)).toBe(false);
  });
});

describe('shouldProactiveRefresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for fresh data (age < threshold)', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 3600; // 1 hour ago
    expect(shouldProactiveRefresh(cachedAt, 82800)).toBe(false);
  });

  it('returns true for data at exactly the stale threshold', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 82800; // exactly 23 hours
    expect(shouldProactiveRefresh(cachedAt, 82800)).toBe(true);
  });

  it('returns true for data beyond the stale threshold', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 85000; // between 23h and 24h
    expect(shouldProactiveRefresh(cachedAt, 82800)).toBe(true);
  });

  it('returns false for data just under threshold', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 82799; // 1 second under 23 hours
    expect(shouldProactiveRefresh(cachedAt, 82800)).toBe(false);
  });
});

describe('getCacheAge', () => {
  it('returns age in seconds', () => {
    const now = 1710000000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const cachedAt = now - 3600;
    expect(getCacheAge(cachedAt)).toBe(3600);
  });
});

describe('shouldBypassCache', () => {
  it('returns true for no-cache directive', () => {
    const request = new Request('http://test.com', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    expect(shouldBypassCache(request)).toBe(true);
  });

  it('returns true for no-store directive', () => {
    const request = new Request('http://test.com', {
      headers: { 'Cache-Control': 'no-store' },
    });
    expect(shouldBypassCache(request)).toBe(true);
  });

  it('returns true for no-cache among multiple directives', () => {
    const request = new Request('http://test.com', {
      headers: { 'Cache-Control': 'max-age=0, no-cache' },
    });
    expect(shouldBypassCache(request)).toBe(true);
  });

  it('returns false for max-age=0', () => {
    const request = new Request('http://test.com', {
      headers: { 'Cache-Control': 'max-age=0' },
    });
    expect(shouldBypassCache(request)).toBe(false);
  });

  it('returns false when no Cache-Control header', () => {
    const request = new Request('http://test.com');
    expect(shouldBypassCache(request)).toBe(false);
  });

  it('handles case-insensitive directives', () => {
    const request = new Request('http://test.com', {
      headers: { 'Cache-Control': 'No-Cache' },
    });
    expect(shouldBypassCache(request)).toBe(true);
  });

  it('returns false for empty Cache-Control header', () => {
    const request = new Request('http://test.com', {
      headers: { 'Cache-Control': '' },
    });
    expect(shouldBypassCache(request)).toBe(false);
  });
});
