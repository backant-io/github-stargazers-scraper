interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;
const MAX_ENTRIES = 10000;

export function checkHealthRateLimit(request: Request): {
  allowed: boolean;
  retryAfter?: number;
} {
  const ip = getClientIP(request);
  const now = Date.now();

  if (rateLimitMap.size > MAX_ENTRIES) {
    for (const [key, entry] of rateLimitMap) {
      if (entry.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  let entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'HEALTH_RATE_LIMITED',
        message: 'Too many health check requests. Please slow down.',
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  );
}

export function resetRateLimitMap(): void {
  rateLimitMap.clear();
}
