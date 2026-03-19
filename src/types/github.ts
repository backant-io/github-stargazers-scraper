export interface RateLimitInfo {
  remaining: number;
  resetAt: string;
}

export interface GitHubHealthStatus {
  status: 'ok' | 'error';
  latencyMs?: number;
  rateLimit?: RateLimitInfo;
  error?: string;
}

export interface TestConnectionResult {
  repositoryName: string;
  stargazerCount: number;
  rateLimit: RateLimitInfo;
}
