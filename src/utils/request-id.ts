export function generateRequestId(): string {
  return crypto.randomUUID();
}

export const REQUEST_ID_HEADER = 'X-Request-ID';
