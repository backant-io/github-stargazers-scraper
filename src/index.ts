import { handleHealth } from './handlers/health';
import { handleStargazers } from './handlers/stargazers';
import { handleSignup } from './handlers/signup';
import { handleCreateKey, handleKeyRotation, handleKeyRevocation } from './handlers/keys';
import { authenticateRequest } from './middleware/auth';
import { applyRateLimit } from './middleware/ratelimit';
import { createUnauthorizedResponse, createRateLimitedResponse } from './types/errors';
import { withRateLimitHeaders } from './utils/headers';
import { createRedisClient } from './services/redis';
import { Env } from './types';
import type { RateLimitInfo } from './types/ratelimit';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

      let rateLimitInfo: RateLimitInfo | undefined;
      const redis = createRedisClient(env);
      if (redis) {
        const rateLimitResult = await applyRateLimit(redis, authResult.context);
        rateLimitInfo = rateLimitResult.info;
        if (!rateLimitResult.allowed) {
          return createRateLimitedResponse(rateLimitResult.retryAfter!, rateLimitResult.info);
        }
      }

      let response: Response;

      if (url.pathname === '/api/v1/stargazers' && request.method === 'GET') {
        response = await handleStargazers(request, env, authResult.context, ctx);
      } else if (url.pathname === '/api/v1/keys' && request.method === 'POST') {
        response = await handleCreateKey(request, env, authResult.context);
      } else if (url.pathname === '/api/v1/keys/rotate' && request.method === 'POST') {
        response = await handleKeyRotation(request, env, authResult.context);
      } else {
        const keyRevokeMatch = url.pathname.match(/^\/api\/v1\/keys\/([a-f0-9-]+)$/);
        if (keyRevokeMatch && request.method === 'DELETE') {
          response = await handleKeyRevocation(request, env, authResult.context, keyRevokeMatch[1]);
        } else {
          response = new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      if (rateLimitInfo) {
        return withRateLimitHeaders(response, rateLimitInfo);
      }
      return response;
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;
