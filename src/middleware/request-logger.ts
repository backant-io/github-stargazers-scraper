import { createLogger, Logger } from '../utils/logger';
import { generateRequestId, REQUEST_ID_HEADER } from '../utils/request-id';
import { redactSensitive, safeApiKeyId } from '../utils/redact';
import type { Env } from '../types';

export interface RequestContext {
  requestId: string;
  startTime: number;
  logger: Logger;
  apiKeyId?: string;
}

export type RequestHandlerWithContext = (
  request: Request,
  env: Env,
  reqCtx: RequestContext,
) => Promise<Response>;

export function withRequestLogging(
  handler: RequestHandlerWithContext,
): (request: Request, env: Env) => Promise<Response> {
  return async (request, env) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const logger = createLogger(env);
    const url = new URL(request.url);

    const authHeader = request.headers.get('Authorization');
    const apiKeyId = authHeader ? safeApiKeyId(authHeader.replace(/^Bearer\s+/i, '')) : undefined;

    const reqCtx: RequestContext = {
      requestId,
      startTime,
      logger,
      apiKeyId,
    };

    logger.debug({
      request_id: requestId,
      method: request.method,
      path: url.pathname,
      query_params: redactSensitive(Object.fromEntries(url.searchParams)),
      api_key_id: apiKeyId,
      message: 'Request started',
    });

    try {
      const response = await handler(request, env, reqCtx);
      const responseTime = Date.now() - startTime;

      const cacheStatus = response.headers.get('X-Cache') as 'HIT' | 'MISS' | 'BYPASS' | null;

      const newHeaders = new Headers(response.headers);
      newHeaders.set(REQUEST_ID_HEADER, requestId);

      logger.info({
        request_id: requestId,
        method: request.method,
        path: url.pathname,
        api_key_id: apiKeyId,
        status_code: response.status,
        response_time_ms: responseTime,
        cache_status: cacheStatus || undefined,
        message: 'Request completed',
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error({
        request_id: requestId,
        method: request.method,
        path: url.pathname,
        api_key_id: apiKeyId,
        response_time_ms: responseTime,
        error_code: error instanceof Error ? error.name : 'UnknownError',
        error_message: error instanceof Error ? error.message : String(error),
        message: 'Request failed',
      });

      throw error;
    }
  };
}
