import { createDatabase } from '../db';
import { createUser } from '../services/users';
import { Errors, ApiError, ValidationError, DuplicateError } from '../types/errors';
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
      throw Errors.invalidRequest('Email is required');
    }

    if (!env.DATABASE_URL) {
      throw Errors.internal();
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
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw Errors.invalidRequest(error.message);
    }
    if (error instanceof DuplicateError) {
      throw Errors.duplicateEmail();
    }
    if (error instanceof SyntaxError) {
      throw Errors.invalidRequest('Invalid JSON body');
    }
    console.error('Signup error:', error);
    throw Errors.internal();
  }
}
