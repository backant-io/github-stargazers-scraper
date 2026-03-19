import type { PlanType } from './auth';

export interface RateLimitConfig {
  requestsPerHour: number;
  burstCapacity: number;
  refillRatePerSecond: number;
}

export const RATE_LIMITS: Record<PlanType, RateLimitConfig> = {
  free: {
    requestsPerHour: 100,
    burstCapacity: 10,
    refillRatePerSecond: 100 / 3600,
  },
  pro: {
    requestsPerHour: 1000,
    burstCapacity: 50,
    refillRatePerSecond: 1000 / 3600,
  },
  enterprise: {
    requestsPerHour: 10000,
    burstCapacity: 500,
    refillRatePerSecond: 10000 / 3600,
  },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: number;
}
