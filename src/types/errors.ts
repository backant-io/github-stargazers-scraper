export type ErrorCode =
  | 'INVALID_REPO'
  | 'REPO_NOT_FOUND'
  | 'PRIVATE_REPO'
  | 'GITHUB_RATE_LIMIT'
  | 'INVALID_FORMAT'
  | 'FORMAT_NOT_IMPLEMENTED';

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
