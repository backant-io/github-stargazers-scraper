import { describe, it, expect } from 'vitest';
import { createRateLimitedResponse } from './errors';

describe('createRateLimitedResponse', () => {
  it('returns 403 status', async () => {
    const response = createRateLimitedResponse(36);
    expect(response.status).toBe(403);
  });

  it('includes Retry-After header', async () => {
    const response = createRateLimitedResponse(60);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('includes Content-Type header', async () => {
    const response = createRateLimitedResponse(36);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns error body with RATE_LIMITED code', async () => {
    const response = createRateLimitedResponse(36);
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
    const response = createRateLimitedResponse(120);
    const body = (await response.json()) as { error: { retry_after: number } };
    expect(body.error.retry_after).toBe(120);
    expect(response.headers.get('Retry-After')).toBe('120');
  });
});
