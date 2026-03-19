interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 4000,
};

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset')
    ) {
      return true;
    }
  }

  const status = (error as { status?: number }).status;
  if (typeof status === 'number' && status >= 500) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isTransientError(error)) {
        throw error;
      }

      if (attempt < options.maxAttempts) {
        const delay = Math.min(
          options.initialDelayMs * Math.pow(2, attempt - 1),
          options.maxDelayMs,
        );
        console.log(
          JSON.stringify({
            level: 'warn',
            message: 'Retrying GitHub API request',
            attempt,
            maxAttempts: options.maxAttempts,
            nextDelayMs: delay,
          }),
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
