export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  checks?: {
    database?: 'ok' | 'error';
    redis?: 'ok' | 'error';
    github_api?: 'ok' | 'error';
  };
}

export interface Env {
  GITHUB_TOKEN?: string;
  DATABASE_URL?: string;
  REDIS_URL?: string;
  API_KEY_SECRET?: string;
}
