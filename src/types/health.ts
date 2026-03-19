export type DependencyStatus = 'ok' | 'error';

export interface DependencyCheckResult {
  status: DependencyStatus;
  latencyMs: number;
  error?: string;
}

export interface HealthChecks {
  database: DependencyStatus;
  redis: DependencyStatus;
  github_api: DependencyStatus;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  checks: HealthChecks;
  response_time_ms: number;
}
