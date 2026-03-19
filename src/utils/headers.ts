import type { RateLimitInfo } from '../types/ratelimit';

export function createRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  if (info.remaining < 0) {
    return {};
  }

  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, info.remaining).toString(),
    'X-RateLimit-Reset': info.resetAt.toString(),
  };
}

export function createRateLimitedHeaders(
  info: RateLimitInfo,
  retryAfter: number,
): Record<string, string> {
  return {
    ...createRateLimitHeaders(info),
    'Retry-After': retryAfter.toString(),
  };
}

export function withRateLimitHeaders(response: Response, info: RateLimitInfo): Response {
  const headers = createRateLimitHeaders(info);
  if (Object.keys(headers).length === 0) {
    return response;
  }

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
