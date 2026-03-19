import { describe, it, expect } from 'vitest';
import { createRateLimitedResponse, createErrorResponse } from './errors';
import type { RateLimitInfo } from './ratelimit';

const defaultInfo: RateLimitInfo = { remaining: 0, limit: 100, resetAt: 1710864000 };

describe('createRateLimitedResponse', () => {
  it('returns 403 status', async () => {
    const response = createRateLimitedResponse(36, defaultInfo);
    expect(response.status).toBe(403);
  });

  it('includes Retry-After header', async () => {
    const response = createRateLimitedResponse(60, defaultInfo);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('includes Content-Type header', async () => {
    const response = createRateLimitedResponse(36, defaultInfo);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('includes rate limit headers', async () => {
    const response = createRateLimitedResponse(36, defaultInfo);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1710864000');
  });

  it('returns error body with RATE_LIMITED code', async () => {
    const response = createRateLimitedResponse(36, defaultInfo);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please retry after the specified time.',
        retry_after: 36,
        documentation_url: expect.any(String),
      },
    });
  });

  it('includes retry_after field in body matching header', async () => {
    const response = createRateLimitedResponse(120, defaultInfo);
    const body = (await response.json()) as { error: { retry_after: number } };
    expect(body.error.retry_after).toBe(120);
    expect(response.headers.get('Retry-After')).toBe('120');
  });
});

describe('createErrorResponse with rate limit info', () => {
  const info: RateLimitInfo = { remaining: 42, limit: 100, resetAt: 1710864000 };

  it('includes rate limit headers when info is provided', () => {
    const response = createErrorResponse('INVALID_REPO', 'Bad repo', 400, info);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('42');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1710864000');
  });

  it('omits rate limit headers when info is not provided', () => {
    const response = createErrorResponse('INVALID_REPO', 'Bad repo', 400);
    expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('does not include Retry-After on non-rate-limited errors', () => {
    const response = createErrorResponse('INVALID_REPO', 'Bad repo', 400, info);
    expect(response.headers.get('Retry-After')).toBeNull();
  });
});
