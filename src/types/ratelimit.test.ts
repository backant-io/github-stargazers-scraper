import { describe, it, expect } from 'vitest';
import { RATE_LIMITS } from './ratelimit';

describe('RATE_LIMITS configuration', () => {
  it('defines limits for free plan', () => {
    expect(RATE_LIMITS.free).toEqual({
      requestsPerHour: 100,
      burstCapacity: 10,
      refillRatePerSecond: 100 / 3600,
    });
  });

  it('defines limits for pro plan', () => {
    expect(RATE_LIMITS.pro).toEqual({
      requestsPerHour: 1000,
      burstCapacity: 50,
      refillRatePerSecond: 1000 / 3600,
    });
  });

  it('defines limits for enterprise plan', () => {
    expect(RATE_LIMITS.enterprise).toEqual({
      requestsPerHour: 10000,
      burstCapacity: 500,
      refillRatePerSecond: 10000 / 3600,
    });
  });

  it('has refillRatePerSecond consistent with requestsPerHour', () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(config.refillRatePerSecond).toBeCloseTo(config.requestsPerHour / 3600, 10);
    }
  });

  it('has burstCapacity less than requestsPerHour for all plans', () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(config.burstCapacity).toBeLessThan(config.requestsPerHour);
    }
  });
});
