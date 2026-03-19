import { handleHealth } from './handlers/health';
import { handleStargazers } from './handlers/stargazers';
import { handleSignup } from './handlers/signup';
import { handleCreateKey, handleKeyRotation, handleKeyRevocation } from './handlers/keys';
import { authenticateRequest } from './middleware/auth';
import { applyRateLimit } from './middleware/ratelimit';
import { withErrorHandler } from './middleware/error-handler';
import { ApiError, ErrorCode, Errors, createRateLimitedResponse } from './types/errors';
import { withRateLimitHeaders } from './utils/headers';
import { createRedisClient } from './services/redis';
import { Env } from './types';
import type { RateLimitInfo } from './types/ratelimit';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withErrorHandler(async (req, e) => {
      const url = new URL(req.url);

      if (url.pathname === '/health' && req.method === 'GET') {
        return handleHealth(e);
      }

      if (url.pathname === '/api/v1/signup') {
        return handleSignup(req, e);
      }

      if (url.pathname.startsWith('/api/v1/')) {
        const authResult = await authenticateRequest(req, e);
        if (!authResult.success) {
          throw Errors.unauthorized();
        }

        let rateLimitInfo: RateLimitInfo | undefined;
        const redis = createRedisClient(e);
        if (redis) {
          const rateLimitResult = await applyRateLimit(redis, authResult.context);
          rateLimitInfo = rateLimitResult.info;
          if (!rateLimitResult.allowed) {
            return createRateLimitedResponse(rateLimitResult.retryAfter!, rateLimitResult.info);
          }
        }

        let response: Response;

        if (url.pathname === '/api/v1/stargazers' && req.method === 'GET') {
          response = await handleStargazers(req, e, authResult.context);
        } else if (url.pathname === '/api/v1/keys' && req.method === 'POST') {
          response = await handleCreateKey(req, e, authResult.context);
        } else if (url.pathname === '/api/v1/keys/rotate' && req.method === 'POST') {
          response = await handleKeyRotation(req, e, authResult.context);
        } else {
          const keyRevokeMatch = url.pathname.match(/^\/api\/v1\/keys\/([a-f0-9-]+)$/);
          if (keyRevokeMatch && req.method === 'DELETE') {
            response = await handleKeyRevocation(req, e, authResult.context, keyRevokeMatch[1]);
          } else {
            throw new ApiError(ErrorCode.INVALID_REQUEST, 'Not Found', undefined);
          }
        }

        if (rateLimitInfo) {
          return withRateLimitHeaders(response, rateLimitInfo);
        }
        return response;
      }

      throw new ApiError(ErrorCode.INVALID_REQUEST, 'Not Found', undefined);
    })(request, env);
  },
} satisfies ExportedHandler<Env>;
