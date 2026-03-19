import { describe, it, expect } from 'vitest';
import { redactSensitive, safeApiKeyId } from './redact';

describe('redactSensitive', () => {
  it('redacts api_key fields', () => {
    const result = redactSensitive({ api_key: 'secret-key-123' });
    expect(result.api_key).toBe('[REDACTED]');
  });

  it('redacts authorization fields', () => {
    const result = redactSensitive({ authorization: 'Bearer abc' });
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('redacts password fields', () => {
    const result = redactSensitive({ password: 'hunter2' });
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts token fields', () => {
    const result = redactSensitive({ token: 'xyz', access_token: 'abc' });
    expect(result.token).toBe('[REDACTED]');
    expect(result.access_token).toBe('[REDACTED]');
  });

  it('redacts email fields', () => {
    const result = redactSensitive({ email: 'user@example.com' });
    expect(result.email).toBe('[REDACTED]');
  });

  it('redacts emails in string values', () => {
    const result = redactSensitive({ message: 'Contact user@example.com for info' });
    expect(result.message).toBe('Contact [REDACTED_EMAIL] for info');
  });

  it('preserves non-sensitive fields', () => {
    const result = redactSensitive({ repo: 'facebook/react', page: '1' });
    expect(result.repo).toBe('facebook/react');
    expect(result.page).toBe('1');
  });

  it('handles nested objects', () => {
    const result = redactSensitive({
      user: { email: 'user@test.com', name: 'Test' },
    });
    expect((result.user as Record<string, unknown>).email).toBe('[REDACTED]');
    expect((result.user as Record<string, unknown>).name).toBe('Test');
  });

  it('handles arrays', () => {
    const result = redactSensitive({
      items: [{ token: 'abc', id: 1 }],
    });
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0].token).toBe('[REDACTED]');
    expect(items[0].id).toBe(1);
  });

  it('returns non-objects as-is', () => {
    expect(redactSensitive(null as unknown as Record<string, unknown>)).toBeNull();
  });

  it('handles case-insensitive matching', () => {
    const result = redactSensitive({ API_KEY: 'secret', Password: 'pw' });
    expect(result.API_KEY).toBe('[REDACTED]');
    expect(result.Password).toBe('[REDACTED]');
  });
});

describe('safeApiKeyId', () => {
  it('returns consistent hash for same key', () => {
    const id1 = safeApiKeyId('my-api-key-12345678');
    const id2 = safeApiKeyId('my-api-key-12345678');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^key_/);
  });

  it('returns different hashes for different keys', () => {
    const id1 = safeApiKeyId('key-aaaaaaaa');
    const id2 = safeApiKeyId('key-bbbbbbbb');
    expect(id1).not.toBe(id2);
  });

  it('returns invalid for short keys', () => {
    expect(safeApiKeyId('short')).toBe('invalid');
  });

  it('returns invalid for empty string', () => {
    expect(safeApiKeyId('')).toBe('invalid');
  });
});
