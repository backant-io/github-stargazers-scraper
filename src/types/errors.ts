export type ErrorCode =
  | 'INVALID_REPO'
  | 'REPO_NOT_FOUND'
  | 'PRIVATE_REPO'
  | 'GITHUB_RATE_LIMIT'
  | 'INVALID_FORMAT'
  | 'FORMAT_NOT_IMPLEMENTED'
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'DUPLICATE_EMAIL'
  | 'KEY_NOT_FOUND'
  | 'FORBIDDEN'
  | 'ALREADY_REVOKED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

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

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    documentation_url: string;
  };
}

const DOCUMENTATION_BASE_URL = 'https://github.com/backant/github-stargazers-scraper#error-codes';

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number,
): Response {
  const body: ErrorResponse = {
    error: {
      code,
      message,
      documentation_url: DOCUMENTATION_BASE_URL,
    },
  };

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createRateLimitedResponse(retryAfter: number): Response {
  const body = {
    error: {
      code: 'RATE_LIMITED' as ErrorCode,
      message: 'Rate limit exceeded. Please retry after the specified time.',
      retry_after: retryAfter,
      documentation_url: DOCUMENTATION_BASE_URL,
    },
  };

  return new Response(JSON.stringify(body), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
    },
  });
}

export function createUnauthorizedResponse(): Response {
  const body: ErrorResponse = {
    error: {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid API key',
      documentation_url: DOCUMENTATION_BASE_URL,
    },
  };

  return new Response(JSON.stringify(body), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer',
    },
  });
}
