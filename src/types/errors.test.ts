import { describe, it, expect } from 'vitest';
import {
  ApiError,
  ErrorCode,
  ErrorStatusMap,
  ErrorMessages,
  Errors,
  createRateLimitedResponse,
  createErrorResponse,
  createGitHubRateLimitResponse,
  createUnauthorizedResponse,
} from './errors';
import type { RateLimitInfo } from './ratelimit';

const defaultInfo: RateLimitInfo = { remaining: 0, limit: 100, resetAt: 1710864000 };

describe('ApiError', () => {
  it('sets code, statusCode, and message from ErrorCode', () => {
    const error = new ApiError(ErrorCode.INVALID_REPO);
    expect(error.code).toBe('INVALID_REPO');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe(ErrorMessages.INVALID_REPO);
    expect(error.name).toBe('ApiError');
  });

  it('allows custom message override', () => {
    const error = new ApiError(ErrorCode.INVALID_REPO, 'Custom message');
    expect(error.message).toBe('Custom message');
    expect(error.code).toBe('INVALID_REPO');
  });

  it('stores retryAfter and resetAt', () => {
    const error = new ApiError(ErrorCode.GITHUB_RATE_LIMIT, undefined, 600, '2026-03-19T12:00:00Z');
    expect(error.retryAfter).toBe(600);
    expect(error.resetAt).toBe('2026-03-19T12:00:00Z');
  });

  it('extends Error', () => {
    const error = new ApiError(ErrorCode.INTERNAL_ERROR);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ApiError.toResponseBody', () => {
  it('returns standardized error body format', () => {
    const error = new ApiError(ErrorCode.REPO_NOT_FOUND);
    const body = error.toResponseBody();

    expect(body).toEqual({
      error: {
        code: 'REPO_NOT_FOUND',
        message: ErrorMessages.REPO_NOT_FOUND,
        documentation_url: expect.stringContaining('error-codes'),
      },
    });
  });

  it('includes retry_after for rate limit errors', () => {
    const error = new ApiError(ErrorCode.RATE_LIMITED, undefined, 60);
    const body = error.toResponseBody();

    expect(body.error.retry_after).toBe(60);
  });

  it('includes reset_at for GitHub rate limit errors', () => {
    const error = new ApiError(ErrorCode.GITHUB_RATE_LIMIT, undefined, 600, '2026-03-19T12:00:00Z');
    const body = error.toResponseBody();

    expect(body.error.retry_after).toBe(600);
    expect(body.error.reset_at).toBe('2026-03-19T12:00:00Z');
  });

  it('omits retry_after when not set', () => {
    const error = new ApiError(ErrorCode.INTERNAL_ERROR);
    const body = error.toResponseBody();

    expect(body.error.retry_after).toBeUndefined();
  });
});

describe('ApiError.toResponse', () => {
  it('returns correct HTTP status code', async () => {
    const error = new ApiError(ErrorCode.REPO_NOT_FOUND);
    const response = error.toResponse();

    expect(response.status).toBe(404);
  });

  it('sets Content-Type to application/json', () => {
    const error = new ApiError(ErrorCode.INTERNAL_ERROR);
    const response = error.toResponse();

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('includes Retry-After header for rate limit errors', () => {
    const error = new ApiError(ErrorCode.GITHUB_RATE_LIMIT, undefined, 300);
    const response = error.toResponse();

    expect(response.headers.get('Retry-After')).toBe('300');
  });

  it('does not include Retry-After for non-rate-limit errors', () => {
    const error = new ApiError(ErrorCode.INVALID_REPO);
    const response = error.toResponse();

    expect(response.headers.get('Retry-After')).toBeNull();
  });

  it('includes WWW-Authenticate for UNAUTHORIZED errors', () => {
    const error = new ApiError(ErrorCode.UNAUTHORIZED);
    const response = error.toResponse();

    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('returns valid JSON body', async () => {
    const error = new ApiError(ErrorCode.INVALID_REPO, 'Bad repo format');
    const response = error.toResponse();
    const body = await response.json();

    expect(body).toEqual({
      error: {
        code: 'INVALID_REPO',
        message: 'Bad repo format',
        documentation_url: expect.stringContaining('error-codes'),
      },
    });
  });
});

describe('ErrorStatusMap', () => {
  it.each([
    ['INVALID_REPO', 400],
    ['UNAUTHORIZED', 401],
    ['RATE_LIMITED', 403],
    ['REPO_NOT_FOUND', 404],
    ['PRIVATE_REPO', 422],
    ['GITHUB_RATE_LIMIT', 429],
    ['INTERNAL_ERROR', 500],
    ['GITHUB_UNAVAILABLE', 503],
  ] as const)('maps %s to status %d', (code, expectedStatus) => {
    expect(ErrorStatusMap[code]).toBe(expectedStatus);
  });
});

describe('Errors factory', () => {
  it('creates invalidRepo error', () => {
    const error = Errors.invalidRepo();
    expect(error.code).toBe('INVALID_REPO');
    expect(error.statusCode).toBe(400);
  });

  it('creates invalidRepo with custom detail', () => {
    const error = Errors.invalidRepo('Missing repo param');
    expect(error.message).toBe('Missing repo param');
  });

  it('creates unauthorized error with 401 and WWW-Authenticate', () => {
    const error = Errors.unauthorized();
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
    const response = error.toResponse();
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('creates rateLimited error with retryAfter', () => {
    const error = Errors.rateLimited(120);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.statusCode).toBe(403);
    expect(error.retryAfter).toBe(120);
  });

  it('creates repoNotFound error', () => {
    const error = Errors.repoNotFound('owner/repo');
    expect(error.code).toBe('REPO_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('owner/repo');
  });

  it('creates privateRepo error', () => {
    const error = Errors.privateRepo('owner/repo');
    expect(error.code).toBe('PRIVATE_REPO');
    expect(error.statusCode).toBe(422);
    expect(error.message).toContain('owner/repo');
  });

  it('creates githubRateLimit error with retryAfter and resetAt', () => {
    const error = Errors.githubRateLimit(600, '2026-03-19T12:00:00Z');
    expect(error.code).toBe('GITHUB_RATE_LIMIT');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(600);
    expect(error.resetAt).toBe('2026-03-19T12:00:00Z');
  });

  it('creates internal error', () => {
    const error = Errors.internal();
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
  });

  it('creates githubUnavailable error', () => {
    const error = Errors.githubUnavailable();
    expect(error.code).toBe('GITHUB_UNAVAILABLE');
    expect(error.statusCode).toBe(503);
  });
});

describe('Error sanitization', () => {
  it('internal error does not expose details', () => {
    const error = Errors.internal();
    const body = error.toResponseBody();

    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(JSON.stringify(body)).not.toContain('trace');
  });

  it('unauthorized error does not reveal key existence', () => {
    const error = Errors.unauthorized();
    expect(error.message).toBe('Missing or invalid API key');
  });
});

describe('createRateLimitedResponse (legacy)', () => {
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

describe('createErrorResponse (legacy) with rate limit info', () => {
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

  it('produces standardized error body', async () => {
    const response = createErrorResponse('INVALID_REPO', 'Bad repo', 400);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'INVALID_REPO',
        message: 'Bad repo',
        documentation_url: expect.stringContaining('error-codes'),
      },
    });
  });
});

describe('createGitHubRateLimitResponse (legacy)', () => {
  const resetAt = '2026-03-19T12:00:00Z';

  it('returns 429 status', () => {
    const response = createGitHubRateLimitResponse(600, resetAt);
    expect(response.status).toBe(429);
  });

  it('includes Retry-After header', () => {
    const response = createGitHubRateLimitResponse(600, resetAt);
    expect(response.headers.get('Retry-After')).toBe('600');
  });

  it('includes Content-Type header', () => {
    const response = createGitHubRateLimitResponse(600, resetAt);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns error body with GITHUB_RATE_LIMIT code', async () => {
    const response = createGitHubRateLimitResponse(600, resetAt);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'GITHUB_RATE_LIMIT',
        message: 'GitHub API rate limit exhausted. Please retry after the specified time.',
        retry_after: 600,
        reset_at: resetAt,
        documentation_url: expect.any(String),
      },
    });
  });

  it('includes retry_after and reset_at in body', async () => {
    const response = createGitHubRateLimitResponse(1800, resetAt);
    const body = (await response.json()) as { error: { retry_after: number; reset_at: string } };
    expect(body.error.retry_after).toBe(1800);
    expect(body.error.reset_at).toBe(resetAt);
  });
});

describe('createUnauthorizedResponse (legacy)', () => {
  it('returns 401 status', () => {
    const response = createUnauthorizedResponse();
    expect(response.status).toBe(401);
  });

  it('includes WWW-Authenticate header', () => {
    const response = createUnauthorizedResponse();
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('returns standardized error body', async () => {
    const response = createUnauthorizedResponse();
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid API key',
        documentation_url: expect.any(String),
      },
    });
  });
});
