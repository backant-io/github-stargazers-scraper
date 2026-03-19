import { createDatabase } from '../db';
import { createApiKey } from '../services/apiKeys';
import { rotateApiKey, revokeApiKey } from '../services/key-rotation';
import { ApiError, Errors } from '../types/errors';
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
      throw Errors.internal();
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
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Create key error:', error);
    throw Errors.internal();
  }
}

export async function handleKeyRotation(
  request: Request,
  env: Env,
  authContext: AuthContext,
): Promise<Response> {
  try {
    if (!env.DATABASE_URL) {
      throw Errors.internal();
    }

    const db = createDatabase(env.DATABASE_URL);
    const result = await rotateApiKey(db, authContext.userId);

    if (!result.success) {
      if (result.error === 'NO_EXISTING_KEY') {
        throw Errors.keyNotFound();
      }
      throw Errors.internal();
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
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Key rotation error:', error);
    throw Errors.internal();
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
      throw Errors.internal();
    }

    const db = createDatabase(env.DATABASE_URL);
    const result = await revokeApiKey(db, keyId, authContext.userId);

    if (!result.success) {
      switch (result.error) {
        case 'KEY_NOT_FOUND':
          throw Errors.keyNotFound();
        case 'NOT_AUTHORIZED':
          throw Errors.forbidden();
        case 'ALREADY_REVOKED':
          throw Errors.alreadyRevoked();
      }
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
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Key revocation error:', error);
    throw Errors.internal();
  }
}
