import { createDatabase } from '../db';
import { createUser } from '../services/users';
import { createErrorResponse } from '../types/errors';
import { ValidationError, DuplicateError } from '../types/errors';
import type { Env } from '../types';
import type { SignupResponse } from '../types/users';

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  try {
    const body = (await request.json()) as { email?: unknown };

    if (!body.email || typeof body.email !== 'string') {
      return createErrorResponse('INVALID_REQUEST', 'Email is required', 400);
    }

    if (!env.DATABASE_URL) {
      return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }

    const db = createDatabase(env.DATABASE_URL);
    const result = await createUser(db, body.email);

    const response: SignupResponse = {
      user: {
        id: result.user.id,
        email: result.user.email,
        created_at: result.user.createdAt.toISOString(),
      },
      api_key: {
        id: result.apiKey.id,
        key: result.apiKey.plaintext,
        plan_type: result.apiKey.planType,
        created_at: result.apiKey.createdAt.toISOString(),
      },
      message: 'Store this API key securely. It will not be shown again.',
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return createErrorResponse('INVALID_REQUEST', error.message, 400);
    }
    if (error instanceof DuplicateError) {
      return createErrorResponse('DUPLICATE_EMAIL', error.message, 409);
    }
    if (error instanceof SyntaxError) {
      return createErrorResponse('INVALID_REQUEST', 'Invalid JSON body', 400);
    }
    console.error('Signup error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
