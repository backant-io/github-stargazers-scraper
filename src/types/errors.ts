import type { RateLimitInfo } from './ratelimit';
import { createRateLimitHeaders, createRateLimitedHeaders } from '../utils/headers';

export const ErrorCode = {
  INVALID_REPO: 'INVALID_REPO',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  REPO_NOT_FOUND: 'REPO_NOT_FOUND',
  PRIVATE_REPO: 'PRIVATE_REPO',
  GITHUB_RATE_LIMIT: 'GITHUB_RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  GITHUB_UNAVAILABLE: 'GITHUB_UNAVAILABLE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  FORMAT_NOT_IMPLEMENTED: 'FORMAT_NOT_IMPLEMENTED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  ALREADY_REVOKED: 'ALREADY_REVOKED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorStatusMap: Record<ErrorCodeType, number> = {
  INVALID_REPO: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 403,
  REPO_NOT_FOUND: 404,
  PRIVATE_REPO: 422,
  GITHUB_RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  GITHUB_UNAVAILABLE: 503,
  INVALID_FORMAT: 400,
  FORMAT_NOT_IMPLEMENTED: 400,
  INVALID_REQUEST: 400,
  DUPLICATE_EMAIL: 409,
  KEY_NOT_FOUND: 404,
  FORBIDDEN: 403,
  ALREADY_REVOKED: 409,
};

export const ErrorMessages: Record<ErrorCodeType, string> = {
  INVALID_REPO: 'Repository format invalid. Expected format: owner/repo',
  UNAUTHORIZED: 'Missing or invalid API key',
  RATE_LIMITED: 'Rate limit exceeded. Please retry after the specified time.',
  REPO_NOT_FOUND: 'GitHub repository does not exist.',
  PRIVATE_REPO: 'Cannot access stargazers of a private repository.',
  GITHUB_RATE_LIMIT: 'GitHub API rate limit exhausted. Please retry after the specified time.',
  INTERNAL_ERROR: 'An unexpected error occurred.',
  GITHUB_UNAVAILABLE: 'GitHub API is temporarily unavailable.',
  INVALID_FORMAT: 'Invalid response format requested.',
  FORMAT_NOT_IMPLEMENTED: 'Requested format is not implemented.',
  INVALID_REQUEST: 'Invalid request.',
  DUPLICATE_EMAIL: 'Email already registered.',
  KEY_NOT_FOUND: 'API key not found.',
  FORBIDDEN: 'Access denied.',
  ALREADY_REVOKED: 'API key is already revoked.',
};

const DOCUMENTATION_BASE_URL = 'https://github.com/backant/github-stargazers-scraper#error-codes';

export interface ErrorResponseBody {
  error: {
    code: ErrorCodeType;
    message: string;
    documentation_url: string;
    retry_after?: number;
    reset_at?: string;
  };
}

export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly retryAfter?: number;
  public readonly resetAt?: string;

  constructor(code: ErrorCodeType, message?: string, retryAfter?: number, resetAt?: string) {
    super(message || ErrorMessages[code]);
    this.code = code;
    this.statusCode = ErrorStatusMap[code];
    this.retryAfter = retryAfter;
    this.resetAt = resetAt;
    this.name = 'ApiError';
  }

  toResponseBody(): ErrorResponseBody {
    const body: ErrorResponseBody = {
      error: {
        code: this.code,
        message: this.message,
        documentation_url: DOCUMENTATION_BASE_URL,
      },
    };

    if (this.retryAfter !== undefined) {
      body.error.retry_after = this.retryAfter;
    }

    if (this.resetAt !== undefined) {
      body.error.reset_at = this.resetAt;
    }

    return body;
  }

  toResponse(): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.retryAfter !== undefined) {
      headers['Retry-After'] = String(this.retryAfter);
    }

    if (this.code === 'UNAUTHORIZED') {
      headers['WWW-Authenticate'] = 'Bearer';
    }

    return new Response(JSON.stringify(this.toResponseBody()), {
      status: this.statusCode,
      headers,
    });
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateError';
  }
}

// Convenience factory functions
export const Errors = {
  invalidRepo: (detail?: string) =>
    new ApiError(ErrorCode.INVALID_REPO, detail || ErrorMessages.INVALID_REPO),

  unauthorized: () => new ApiError(ErrorCode.UNAUTHORIZED),

  rateLimited: (retryAfter: number) => new ApiError(ErrorCode.RATE_LIMITED, undefined, retryAfter),

  repoNotFound: (repo?: string) =>
    new ApiError(
      ErrorCode.REPO_NOT_FOUND,
      repo ? `Repository '${repo}' not found on GitHub.` : undefined,
    ),

  privateRepo: (repo?: string) =>
    new ApiError(
      ErrorCode.PRIVATE_REPO,
      repo ? `Repository '${repo}' is private and cannot be accessed.` : undefined,
    ),

  githubRateLimit: (retryAfter: number, resetAt?: string) =>
    new ApiError(ErrorCode.GITHUB_RATE_LIMIT, undefined, retryAfter, resetAt),

  internal: () => new ApiError(ErrorCode.INTERNAL_ERROR),

  githubUnavailable: () => new ApiError(ErrorCode.GITHUB_UNAVAILABLE),

  invalidFormat: (detail?: string) =>
    new ApiError(ErrorCode.INVALID_FORMAT, detail || ErrorMessages.INVALID_FORMAT),

  invalidRequest: (detail?: string) =>
    new ApiError(ErrorCode.INVALID_REQUEST, detail || ErrorMessages.INVALID_REQUEST),

  duplicateEmail: () => new ApiError(ErrorCode.DUPLICATE_EMAIL),

  keyNotFound: () => new ApiError(ErrorCode.KEY_NOT_FOUND),

  forbidden: () => new ApiError(ErrorCode.FORBIDDEN),

  alreadyRevoked: () => new ApiError(ErrorCode.ALREADY_REVOKED),
};

// Legacy helpers preserved for backward compatibility during migration
export interface ErrorResponse {
  error: {
    code: ErrorCodeType;
    message: string;
    documentation_url: string;
  };
}

export function createErrorResponse(
  code: ErrorCodeType,
  message: string,
  statusCode: number,
  rateLimitInfo?: RateLimitInfo,
): Response {
  const apiError = new ApiError(code, message);
  const body = apiError.toResponseBody();

  const rateLimitHeaders = rateLimitInfo ? createRateLimitHeaders(rateLimitInfo) : {};

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json', ...rateLimitHeaders },
  });
}

export function createRateLimitedResponse(retryAfter: number, info: RateLimitInfo): Response {
  const apiError = new ApiError(ErrorCode.RATE_LIMITED, undefined, retryAfter);
  const body = apiError.toResponseBody();

  const headers = createRateLimitedHeaders(info, retryAfter);

  return new Response(JSON.stringify(body), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function createGitHubRateLimitResponse(retryAfter: number, resetAt: string): Response {
  const apiError = new ApiError(ErrorCode.GITHUB_RATE_LIMIT, undefined, retryAfter, resetAt);
  return apiError.toResponse();
}

export function createUnauthorizedResponse(): Response {
  return Errors.unauthorized().toResponse();
}
