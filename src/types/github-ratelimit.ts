export interface GitHubRateLimitState {
  remaining: number;
  limit: number;
  resetAt: string;
  lastUpdated: number;
}

export interface GitHubRateLimitConfig {
  approachingThreshold: number;
  exhaustedThreshold: number;
}

export const GITHUB_RATE_LIMIT_CONFIG: GitHubRateLimitConfig = {
  approachingThreshold: 100,
  exhaustedThreshold: 0,
};

export type RateLimitAction = 'proceed' | 'queue' | 'use_cache' | 'reject';

export interface GitHubRateLimitCheckResult {
  action: RateLimitAction;
  state: GitHubRateLimitState | null;
  retryAfter?: number;
  warning?: string;
}
