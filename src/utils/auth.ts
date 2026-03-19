export type ParsedAuth =
  | { success: true; token: string }
  | { success: false; error: 'missing' | 'malformed' };

export function parseAuthorizationHeader(header: string | null): ParsedAuth {
  if (!header) {
    return { success: false, error: 'missing' };
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { success: false, error: 'malformed' };
  }

  const token = parts[1];
  if (!token || token.length < 32) {
    return { success: false, error: 'malformed' };
  }

  return { success: true, token };
}

export async function hashApiKey(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
