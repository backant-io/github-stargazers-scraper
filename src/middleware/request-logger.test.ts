import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRequestLogging } from './request-logger';
import { REQUEST_ID_HEADER } from '../utils/request-id';
import type { Env } from '../types';

const mockEnv = { LOG_LEVEL: 'debug' } as Env;

describe('withRequestLogging', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  it('adds X-Request-ID header to successful responses', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withRequestLogging(handler);
    const response = await wrapped(new Request('https://example.com/test'), mockEnv);

    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.status).toBe(200);
  });

  it('logs request start at debug level and completion at info level', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withRequestLogging(handler);
    await wrapped(new Request('https://example.com/api/v1/stargazers'), mockEnv);

    // debug (request started) + info (request completed) both go to console.log
    expect(consoleSpy.log).toHaveBeenCalledTimes(2);

    const debugLog = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
    expect(debugLog.level).toBe('debug');
    expect(debugLog.message).toBe('Request started');
    expect(debugLog.path).toBe('/api/v1/stargazers');

    const infoLog = JSON.parse(consoleSpy.log.mock.calls[1][0] as string);
    expect(infoLog.level).toBe('info');
    expect(infoLog.message).toBe('Request completed');
    expect(infoLog.status_code).toBe(200);
    expect(typeof infoLog.response_time_ms).toBe('number');
  });

  it('logs cache status from X-Cache header', async () => {
    const response = new Response('ok', {
      status: 200,
      headers: { 'X-Cache': 'HIT' },
    });
    const handler = vi.fn().mockResolvedValue(response);
    const wrapped = withRequestLogging(handler);
    await wrapped(new Request('https://example.com/test'), mockEnv);

    const infoLog = JSON.parse(consoleSpy.log.mock.calls[1][0] as string);
    expect(infoLog.cache_status).toBe('HIT');
  });

  it('extracts API key identifier from Authorization header', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withRequestLogging(handler);
    const request = new Request('https://example.com/test', {
      headers: { Authorization: 'Bearer my-secret-api-key-12345678' },
    });
    await wrapped(request, mockEnv);

    const debugLog = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
    expect(debugLog.api_key_id).toMatch(/^key_/);
    expect(debugLog.api_key_id).not.toContain('my-secret-api-key');
  });

  it('logs errors and re-throws on handler failure', async () => {
    const error = new Error('handler crashed');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = withRequestLogging(handler);

    await expect(wrapped(new Request('https://example.com/test'), mockEnv)).rejects.toThrow(
      'handler crashed',
    );

    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    const errorLog = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
    expect(errorLog.level).toBe('error');
    expect(errorLog.error_message).toBe('handler crashed');
    expect(typeof errorLog.response_time_ms).toBe('number');
  });

  it('passes request context to handler', async () => {
    const handler = vi.fn().mockImplementation(async (_req, _env, reqCtx) => {
      expect(reqCtx.requestId).toBeDefined();
      expect(typeof reqCtx.startTime).toBe('number');
      expect(reqCtx.logger).toBeDefined();
      return new Response('ok');
    });
    const wrapped = withRequestLogging(handler);
    await wrapped(new Request('https://example.com/test'), mockEnv);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive query params', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withRequestLogging(handler);
    await wrapped(
      new Request('https://example.com/test?api_key=secret123&repo=facebook/react'),
      mockEnv,
    );

    const debugLog = JSON.parse(consoleSpy.log.mock.calls[0][0] as string);
    expect(debugLog.query_params.api_key).toBe('[REDACTED]');
    expect(debugLog.query_params.repo).toBe('facebook/react');
  });

  it('response time is accurate within tolerance', async () => {
    const handler = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(new Response('ok')), 50)),
      );
    const wrapped = withRequestLogging(handler);
    await wrapped(new Request('https://example.com/test'), mockEnv);

    const infoLog = JSON.parse(consoleSpy.log.mock.calls[1][0] as string);
    expect(infoLog.response_time_ms).toBeGreaterThanOrEqual(40);
    expect(infoLog.response_time_ms).toBeLessThan(200);
  });
});
