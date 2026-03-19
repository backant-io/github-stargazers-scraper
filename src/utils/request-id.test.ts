import { describe, it, expect } from 'vitest';
import { generateRequestId, REQUEST_ID_HEADER } from './request-id';

describe('generateRequestId', () => {
  it('returns a valid UUID v4 format', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateRequestId());
    }
    expect(ids.size).toBe(1000);
  });
});

describe('REQUEST_ID_HEADER', () => {
  it('is X-Request-ID', () => {
    expect(REQUEST_ID_HEADER).toBe('X-Request-ID');
  });
});
