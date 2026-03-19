import { describe, it, expect, vi } from 'vitest';
import { withErrorHandler } from './error-handler';
import { Errors } from '../types/errors';
import { REQUEST_ID_HEADER } from '../utils/request-id';
import type { Env } from '../types';
import type { RequestContext } from './request-logger';
import { Logger } from '../utils/logger';

function makeRequest(path = '/test'): Request {
  return new Request(`https://example.com${path}`);
}

const mockEnv = {} as Env;

function makeReqCtx(overrides?: Partial<RequestContext>): RequestContext {
  return {
    requestId: 'test-request-id',
    startTime: Date.now(),
    logger: new Logger({ level: 'error', service: 'test' }),
    ...overrides,
  };
}

describe('withErrorHandler', () => {
  it('passes through successful responses', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withErrorHandler(handler);
    const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('catches ApiError and returns standardized response with request ID', async () => {
    const handler = vi.fn().mockRejectedValue(Errors.unauthorized());
    const wrapped = withErrorHandler(handler);
    const reqCtx = makeReqCtx();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await wrapped(makeRequest(), mockEnv, reqCtx);

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('test-request-id');

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
        documentation_url: expect.any(String),
      },
    });

    consoleSpy.mockRestore();
  });

  it('catches ApiError with retryAfter and includes header', async () => {
    const handler = vi.fn().mockRejectedValue(Errors.rateLimited(120));
    const wrapped = withErrorHandler(handler);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());

    expect(response.status).toBe(403);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('test-request-id');

    consoleSpy.mockRestore();
  });

  it('converts unknown Error to INTERNAL_ERROR', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('something broke'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = withErrorHandler(handler);
    const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(body.error.message).not.toContain('something broke');

    consoleSpy.mockRestore();
  });

  it('converts thrown string to INTERNAL_ERROR', async () => {
    const handler = vi.fn().mockRejectedValue('raw string error');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = withErrorHandler(handler);
    const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');

    consoleSpy.mockRestore();
  });

  it('converts null/undefined thrown to INTERNAL_ERROR', async () => {
    const handler = vi.fn().mockRejectedValue(null);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = withErrorHandler(handler);
    const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');

    consoleSpy.mockRestore();
  });

  it('logs error details with request context', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('database connection failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = withErrorHandler(handler);
    await wrapped(makeRequest(), mockEnv, makeReqCtx());

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('database connection failed'));

    consoleSpy.mockRestore();
  });

  it('never exposes stack traces in response body', async () => {
    const error = new Error('secret internal error');
    error.stack = 'Error: secret\n    at /src/secret/path.ts:42:10';
    const handler = vi.fn().mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = withErrorHandler(handler);
    const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());

    const text = await response.text();
    expect(text).not.toContain('stack');
    expect(text).not.toContain('/src/secret/path.ts');
    expect(text).not.toContain('secret internal error');

    consoleSpy.mockRestore();
  });

  it('all error responses have Content-Type and X-Request-ID', async () => {
    const errors = [
      Errors.invalidRepo(),
      Errors.unauthorized(),
      Errors.rateLimited(60),
      Errors.repoNotFound('a/b'),
      Errors.privateRepo('a/b'),
      Errors.githubRateLimit(300),
      Errors.internal(),
      Errors.githubUnavailable(),
    ];

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    for (const error of errors) {
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = withErrorHandler(handler);
      const response = await wrapped(makeRequest(), mockEnv, makeReqCtx());
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get(REQUEST_ID_HEADER)).toBe('test-request-id');
    }

    consoleSpy.mockRestore();
  });
});
