import { describe, it, expect } from 'vitest';
import { formatIsoDate } from './date';

describe('formatIsoDate', () => {
  it('formats a Date object to ISO 8601', () => {
    const date = new Date('2024-01-15T10:30:00.000Z');
    expect(formatIsoDate(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('passes through a valid ISO string', () => {
    expect(formatIsoDate('2024-01-15T10:30:00.000Z')).toBe('2024-01-15T10:30:00.000Z');
  });

  it('normalizes a non-ISO date string to ISO format', () => {
    const result = formatIsoDate('January 15, 2024 10:30:00 UTC');
    expect(result).toBe('2024-01-15T10:30:00.000Z');
  });

  it('throws for invalid date string', () => {
    expect(() => formatIsoDate('not-a-date')).toThrow('Invalid date string: not-a-date');
  });
});
