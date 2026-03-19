import { ApiError, Errors } from '../types/errors';
import { REQUEST_ID_HEADER } from '../utils/request-id';
import type { Env } from '../types';
import type { RequestContext } from './request-logger';

export type RequestHandlerWithContext = (
  request: Request,
  env: Env,
  reqCtx: RequestContext,
) => Promise<Response>;

export function withErrorHandler(handler: RequestHandlerWithContext): RequestHandlerWithContext {
  return async (request, env, reqCtx) => {
    try {
      return await handler(request, env, reqCtx);
    } catch (error) {
      reqCtx.logger.error({
        request_id: reqCtx.requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        api_key_id: reqCtx.apiKeyId,
        error_code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
        error_message: error instanceof Error ? error.message : String(error),
        message: 'Error handled',
      });

      const apiError = error instanceof ApiError ? error : Errors.internal();
      const response = apiError.toResponse();

      const newHeaders = new Headers(response.headers);
      newHeaders.set(REQUEST_ID_HEADER, reqCtx.requestId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }
  };
}
