import { parseAuthorizationHeader, hashApiKey } from '../utils/auth';
import { lookupApiKey } from '../services/auth';
import { createDatabase } from '../db';
import type { AuthResult } from '../types/auth';
import type { Env } from '../types';

export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  const parsed = parseAuthorizationHeader(authHeader);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error === 'missing' ? 'missing_header' : 'malformed_header',
    };
  }

  const keyHash = await hashApiKey(parsed.token);

  if (!env.DATABASE_URL) {
    return { success: false, error: 'invalid_key' };
  }

  const db = createDatabase(env.DATABASE_URL);
  const apiKey = await lookupApiKey(db, keyHash);

  if (!apiKey) {
    return { success: false, error: 'invalid_key' };
  }

  return {
    success: true,
    context: {
      userId: apiKey.user_id,
      keyId: apiKey.id,
      planType: apiKey.plan_type,
    },
  };
}
