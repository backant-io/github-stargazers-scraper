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
export type {
  HealthResponse,
  HealthChecks,
  DependencyCheckResult,
  DependencyStatus,
} from './health';

export interface Env {
  GITHUB_TOKEN?: string;
  DATABASE_URL?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  API_KEY_SECRET?: string;
  HYPERDRIVE?: Hyperdrive;
  LOG_LEVEL?: string;
}
