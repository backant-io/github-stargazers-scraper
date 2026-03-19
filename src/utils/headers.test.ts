import { describe, it, expect } from 'vitest';
import { createRateLimitHeaders, createRateLimitedHeaders, withRateLimitHeaders } from './headers';
import type { RateLimitInfo } from '../types/ratelimit';

describe('createRateLimitHeaders', () => {
  const info: RateLimitInfo = { remaining: 42, limit: 100, resetAt: 1710864000 };

  it('returns correct header object', () => {
    const headers = createRateLimitHeaders(info);
    expect(headers).toEqual({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '42',
      'X-RateLimit-Reset': '1710864000',
    });
  });

  it('returns string values representing integers', () => {
    const headers = createRateLimitHeaders(info);
    for (const value of Object.values(headers)) {
      expect(value).toMatch(/^\d+$/);
    }
  });

  it('returns empty object for any negative remaining value', () => {
    const headers = createRateLimitHeaders({ remaining: -0.5, limit: 100, resetAt: 1710864000 });
    expect(headers).toEqual({});
  });

  it('returns empty object when remaining is -1 (Redis unavailable)', () => {
    const headers = createRateLimitHeaders({ remaining: -1, limit: 100, resetAt: 0 });
    expect(headers).toEqual({});
  });

  it('reflects post-consumption state (remaining = limit - 1 on first request)', () => {
    const firstRequest: RateLimitInfo = { remaining: 99, limit: 100, resetAt: 1710864000 };
    const headers = createRateLimitHeaders(firstRequest);
    expect(headers['X-RateLimit-Remaining']).toBe('99');
    expect(headers['X-RateLimit-Limit']).toBe('100');
  });
});

describe('createRateLimitedHeaders', () => {
  const info: RateLimitInfo = { remaining: 0, limit: 100, resetAt: 1710864000 };

  it('includes Retry-After header', () => {
    const headers = createRateLimitedHeaders(info, 3600);
    expect(headers['Retry-After']).toBe('3600');
  });

  it('includes all rate limit headers plus Retry-After', () => {
    const headers = createRateLimitedHeaders(info, 60);
    expect(headers).toEqual({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': '1710864000',
      'Retry-After': '60',
    });
  });
});

describe('withRateLimitHeaders', () => {
  const info: RateLimitInfo = { remaining: 42, limit: 100, resetAt: 1710864000 };

  it('adds rate limit headers to response', () => {
    const original = new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    const result = withRateLimitHeaders(original, info);
    expect(result.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(result.headers.get('X-RateLimit-Remaining')).toBe('42');
    expect(result.headers.get('X-RateLimit-Reset')).toBe('1710864000');
    expect(result.headers.get('Content-Type')).toBe('application/json');
  });

  it('preserves original response status', () => {
    const original = new Response('error', { status: 400 });
    const result = withRateLimitHeaders(original, info);
    expect(result.status).toBe(400);
  });

  it('preserves original response body', async () => {
    const body = JSON.stringify({ data: 'test' });
    const original = new Response(body, { status: 200 });
    const result = withRateLimitHeaders(original, info);
    expect(await result.text()).toBe(body);
  });

  it('returns original response when info.remaining is -1', () => {
    const original = new Response('ok', { status: 200 });
    const result = withRateLimitHeaders(original, { remaining: -1, limit: 100, resetAt: 0 });
    expect(result.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('does not include Retry-After on successful responses', () => {
    const original = new Response('ok', { status: 200 });
    const result = withRateLimitHeaders(original, info);
    expect(result.headers.get('Retry-After')).toBeNull();
  });
});
