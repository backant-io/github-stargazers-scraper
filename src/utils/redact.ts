const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /authorization/i,
  /password/i,
  /secret/i,
  /token/i,
  /bearer/i,
  /email/i,
  /credential/i,
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function redactSensitive<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const isSensitiveKey = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitiveKey) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] = value.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? redactSensitive(item as Record<string, unknown>)
          : item,
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

export function safeApiKeyId(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return 'invalid';
  }
  const suffix = apiKey.slice(-8);
  return `key_${suffix
    .split('')
    .reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0)
    .toString(16)}`;
}
