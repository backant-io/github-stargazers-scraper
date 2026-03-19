export type { ErrorCode, ErrorResponse } from './errors';
export {
  createErrorResponse,
  createUnauthorizedResponse,
  createRateLimitedResponse,
  createGitHubRateLimitResponse,
  ValidationError,
  DuplicateError,
} from './errors';
export type { AuthContext, ApiKeyRecord, AuthResult, PlanType } from './auth';

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  checks?: {
    database?: 'ok' | 'error';
    redis?: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    github_api?: {
      status: 'ok' | 'error';
      latencyMs?: number;
      rateLimit?: { remaining: number; resetAt: string };
      error?: string;
    };
    github_rate_limit?: {
      status: 'ok' | 'approaching' | 'exhausted';
      remaining?: number;
      limit?: number;
      resetAt?: string;
      resetInSeconds?: number;
    };
  };
}

export interface Env {
  GITHUB_TOKEN?: string;
  DATABASE_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  API_KEY_SECRET?: string;
  HYPERDRIVE?: Hyperdrive;
}
