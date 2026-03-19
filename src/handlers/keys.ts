import { createDatabase } from '../db';
import { createApiKey } from '../services/apiKeys';
import { rotateApiKey, revokeApiKey } from '../services/key-rotation';
import { createErrorResponse } from '../types/errors';
import type { Env } from '../types';
import type { AuthContext } from '../types/auth';
import type { CreateKeyResponse } from '../types/apiKeys';

export async function handleCreateKey(
  request: Request,
  env: Env,
  authContext: AuthContext,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  try {
    if (!env.DATABASE_URL) {
      return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }

    const db = createDatabase(env.DATABASE_URL);
    const apiKey = await createApiKey(db, authContext.userId, authContext.planType);

    const response: CreateKeyResponse = {
      api_key: {
        id: apiKey.id,
        key: apiKey.plaintext,
        plan_type: apiKey.planType,
        created_at: apiKey.createdAt.toISOString(),
      },
      message: 'Store this API key securely. It will not be shown again.',
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create key error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function handleKeyRotation(
  request: Request,
  env: Env,
  authContext: AuthContext,
): Promise<Response> {
  try {
    if (!env.DATABASE_URL) {
      return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }

    const db = createDatabase(env.DATABASE_URL);
    const result = await rotateApiKey(db, authContext.userId);

    if (!result.success) {
      if (result.error === 'NO_EXISTING_KEY') {
        return createErrorResponse('KEY_NOT_FOUND', 'No active API key found to rotate', 400);
      }
      return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }

    return new Response(
      JSON.stringify({
        api_key: result.apiKey,
        key_id: result.keyId,
        old_key_expires_at: result.expiresOldKeyAt.toISOString(),
        message:
          'New API key generated. Your old key will remain valid for 1 hour. Save your new key securely - it cannot be retrieved again.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Key rotation error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function handleKeyRevocation(
  request: Request,
  env: Env,
  authContext: AuthContext,
  keyId: string,
): Promise<Response> {
  try {
    if (!env.DATABASE_URL) {
      return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }

    const db = createDatabase(env.DATABASE_URL);
    const result = await revokeApiKey(db, keyId, authContext.userId);

    if (!result.success) {
      const errorMap = {
        KEY_NOT_FOUND: { code: 'KEY_NOT_FOUND' as const, message: 'API key not found', status: 404 },
        NOT_AUTHORIZED: { code: 'FORBIDDEN' as const, message: 'Not authorized to revoke this key', status: 403 },
        ALREADY_REVOKED: { code: 'ALREADY_REVOKED' as const, message: 'Key is already revoked', status: 400 },
      };
      const err = errorMap[result.error];
      return createErrorResponse(err.code, err.message, err.status);
    }

    return new Response(
      JSON.stringify({
        message: 'API key revoked successfully',
        revoked_at: result.revokedAt.toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Key revocation error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
