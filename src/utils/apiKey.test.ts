import { describe, it, expect } from 'vitest';
import { generateApiKey } from './apiKey';

describe('generateApiKey', () => {
  it('produces a string with sk_live_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('sk_live_')).toBe(true);
  });

  it('produces a 72-character string (8 prefix + 64 hex)', () => {
    const key = generateApiKey();
    expect(key.length).toBe(72);
  });

  it('contains only valid hex characters after prefix', () => {
    const key = generateApiKey();
    const hex = key.slice(8);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values across multiple generations', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      keys.add(generateApiKey());
    }
    expect(keys.size).toBe(1000);
  });
});
