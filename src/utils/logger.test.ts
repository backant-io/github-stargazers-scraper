import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, createLogger } from './logger';

describe('Logger', () => {
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

  describe('log level filtering', () => {
    it('debug level emits all logs', () => {
      const logger = new Logger({ level: 'debug', service: 'test' });
      logger.debug({ request_id: '1', message: 'debug msg' });
      logger.info({ request_id: '2', message: 'info msg' });
      logger.warn({ request_id: '3', message: 'warn msg' });
      logger.error({ request_id: '4', message: 'error msg' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('info level filters out debug', () => {
      const logger = new Logger({ level: 'info', service: 'test' });
      logger.debug({ request_id: '1', message: 'debug msg' });
      logger.info({ request_id: '2', message: 'info msg' });
      logger.warn({ request_id: '3', message: 'warn msg' });
      logger.error({ request_id: '4', message: 'error msg' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('warn level filters out debug and info', () => {
      const logger = new Logger({ level: 'warn', service: 'test' });
      logger.debug({ request_id: '1' });
      logger.info({ request_id: '2' });
      logger.warn({ request_id: '3' });
      logger.error({ request_id: '4' });

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('error level only emits errors', () => {
      const logger = new Logger({ level: 'error', service: 'test' });
      logger.debug({ request_id: '1' });
      logger.info({ request_id: '2' });
      logger.warn({ request_id: '3' });
      logger.error({ request_id: '4' });

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('structured JSON output', () => {
    it('produces valid JSON with required fields', () => {
      const logger = new Logger({ level: 'debug', service: 'test-svc' });
      logger.info({
        request_id: 'abc-123',
        method: 'GET',
        path: '/test',
        status_code: 200,
      });

      const output = consoleSpy.log.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.service).toBe('test-svc');
      expect(parsed.level).toBe('info');
      expect(parsed.request_id).toBe('abc-123');
      expect(parsed.method).toBe('GET');
      expect(parsed.path).toBe('/test');
      expect(parsed.status_code).toBe(200);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes ISO 8601 timestamp', () => {
      const logger = new Logger({ level: 'debug', service: 'test' });
      logger.info({ request_id: 'x' });

      const output = consoleSpy.log.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      const date = new Date(parsed.timestamp);
      expect(date.toISOString()).toBe(parsed.timestamp);
    });
  });

  describe('createLogger factory', () => {
    it('defaults to info level', () => {
      const logger = createLogger({});
      logger.debug({ request_id: '1' });
      logger.info({ request_id: '2' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it('respects LOG_LEVEL env var', () => {
      const logger = createLogger({ LOG_LEVEL: 'debug' });
      logger.debug({ request_id: '1' });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });
  });
});
