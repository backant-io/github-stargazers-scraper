import { describe, it, expect } from 'vitest';
import { parseAuthorizationHeader, hashApiKey } from './auth';

describe('parseAuthorizationHeader', () => {
  it('returns missing error when header is null', () => {
    expect(parseAuthorizationHeader(null)).toEqual({
      success: false,
      error: 'missing',
    });
  });

  it('returns missing error when header is empty string', () => {
    expect(parseAuthorizationHeader('')).toEqual({
      success: false,
      error: 'missing',
    });
  });

  it('returns malformed error for Basic auth scheme', () => {
    expect(parseAuthorizationHeader('Basic dXNlcjpwYXNz')).toEqual({
      success: false,
      error: 'malformed',
    });
  });

  it('returns malformed error for Bearer with no token', () => {
    expect(parseAuthorizationHeader('Bearer')).toEqual({
      success: false,
      error: 'malformed',
    });
  });

  it('returns malformed error for Bearer with short token', () => {
    expect(parseAuthorizationHeader('Bearer abc')).toEqual({
      success: false,
      error: 'malformed',
    });
  });

  it('returns malformed error for lowercase bearer', () => {
    const token = 'a'.repeat(32);
    expect(parseAuthorizationHeader(`bearer ${token}`)).toEqual({
      success: false,
      error: 'malformed',
    });
  });

  it('returns malformed error for extra spaces in header', () => {
    const token = 'a'.repeat(32);
    expect(parseAuthorizationHeader(`Bearer  ${token}`)).toEqual({
      success: false,
      error: 'malformed',
    });
  });

  it('returns success with token for valid Bearer header', () => {
    const token = 'sk_live_' + 'a'.repeat(32);
    const result = parseAuthorizationHeader(`Bearer ${token}`);
    expect(result).toEqual({ success: true, token });
  });

  it('accepts token exactly 32 characters long', () => {
    const token = 'x'.repeat(32);
    const result = parseAuthorizationHeader(`Bearer ${token}`);
    expect(result).toEqual({ success: true, token });
  });

  it('rejects token of 31 characters', () => {
    const token = 'x'.repeat(31);
    expect(parseAuthorizationHeader(`Bearer ${token}`)).toEqual({
      success: false,
      error: 'malformed',
    });
  });
});

describe('hashApiKey', () => {
  it('returns a 64-character lowercase hex string', async () => {
    const hash = await hashApiKey('test-api-key');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces consistent hashes for the same input', async () => {
    const hash1 = await hashApiKey('my-secret-key');
    const hash2 = await hashApiKey('my-secret-key');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await hashApiKey('key-one');
    const hash2 = await hashApiKey('key-two');
    expect(hash1).not.toBe(hash2);
  });
});
