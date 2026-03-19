export interface RateLimitStatus {
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(token: string): Promise<RateLimitStatus> {
  const response = await fetch('https://api.github.com/rate_limit', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'github-stargazers-scraper',
    },
  });

  if (!response.ok) {
    throw new Error(`Rate limit check failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    rate: { remaining: number; reset: number };
  };

  return {
    remaining: data.rate.remaining,
    resetAt: new Date(data.rate.reset * 1000),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RATE_LIMIT_THRESHOLD = 10;
const MAX_WAIT_MS = 60_000;

export async function ensureRateLimit(token: string): Promise<RateLimitStatus> {
  const status = await checkRateLimit(token);

  if (status.remaining >= RATE_LIMIT_THRESHOLD) {
    return status;
  }

  const waitMs = status.resetAt.getTime() - Date.now();

  if (waitMs > 0 && waitMs <= MAX_WAIT_MS) {
    console.log(
      JSON.stringify({
        level: 'warn',
        message: 'Rate limit approaching, waiting for reset',
        remaining: status.remaining,
        waitMs,
        resetAt: status.resetAt.toISOString(),
      }),
    );
    await sleep(waitMs);
    return checkRateLimit(token);
  }

  if (waitMs > MAX_WAIT_MS) {
    throw new RateLimitError(
      `Rate limit exhausted. Resets at ${status.resetAt.toISOString()}`,
      status,
    );
  }

  return status;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly rateLimitStatus: RateLimitStatus,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
