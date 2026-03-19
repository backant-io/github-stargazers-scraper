import { createDatabase } from '../db';
import { createApiKey } from '../services/apiKeys';
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
