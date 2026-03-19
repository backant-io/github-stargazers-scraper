import { handleHealth } from './handlers/health';
import { handleStargazers } from './handlers/stargazers';
import { handleSignup } from './handlers/signup';
import { handleCreateKey } from './handlers/keys';
import { authenticateRequest } from './middleware/auth';
import { createUnauthorizedResponse } from './types/errors';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return handleHealth(env);
    }

    if (url.pathname === '/api/v1/signup') {
      return handleSignup(request, env);
    }

    if (url.pathname.startsWith('/api/v1/')) {
      const authResult = await authenticateRequest(request, env);
      if (!authResult.success) {
        return createUnauthorizedResponse();
      }

      if (url.pathname === '/api/v1/stargazers' && request.method === 'GET') {
        return handleStargazers(request, env, authResult.context);
      }

      if (url.pathname === '/api/v1/keys' && request.method === 'POST') {
        return handleCreateKey(request, env, authResult.context);
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;
