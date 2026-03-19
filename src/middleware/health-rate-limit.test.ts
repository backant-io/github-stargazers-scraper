import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkHealthRateLimit,
  createRateLimitResponse,
  resetRateLimitMap,
} from './health-rate-limit';

function createRequest(ip: string = '1.2.3.4'): Request {
  return new Request('https://api.test/health', {
    headers: { 'CF-Connecting-IP': ip },
  });
}

describe('checkHealthRateLimit', () => {
  beforeEach(() => {
    resetRateLimitMap();
  });

  it('allows the first request', () => {
    const result = checkHealthRateLimit(createRequest());
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('allows up to 100 requests per IP', () => {
    const req = createRequest();
    for (let i = 0; i < 100; i++) {
      const result = checkHealthRateLimit(req);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks request 101 from the same IP', () => {
    const req = createRequest();
    for (let i = 0; i < 100; i++) {
      checkHealthRateLimit(req);
    }

    const result = checkHealthRateLimit(req);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('tracks rate limits per IP independently', () => {
    const reqA = createRequest('10.0.0.1');
    const reqB = createRequest('10.0.0.2');

    for (let i = 0; i < 100; i++) {
      checkHealthRateLimit(reqA);
    }

    // IP A is at limit
    expect(checkHealthRateLimit(reqA).allowed).toBe(false);
    // IP B is still fine
    expect(checkHealthRateLimit(reqB).allowed).toBe(true);
  });

  it('falls back to X-Forwarded-For when CF-Connecting-IP is absent', () => {
    const req = new Request('https://api.test/health', {
      headers: { 'X-Forwarded-For': '5.6.7.8, 1.2.3.4' },
    });

    const result = checkHealthRateLimit(req);
    expect(result.allowed).toBe(true);
  });

  it('uses unknown when no IP header is present', () => {
    const req = new Request('https://api.test/health');
    const result = checkHealthRateLimit(req);
    expect(result.allowed).toBe(true);
  });
});

describe('createRateLimitResponse', () => {
  it('returns 429 with Retry-After header', async () => {
    const response = createRateLimitResponse(30);

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('HEALTH_RATE_LIMITED');
    expect(body.error.message).toBeDefined();
  });
});
