import { ApiError, Errors } from '../types/errors';
import type { Env } from '../types';

export type RequestHandler = (
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
) => Promise<Response>;

export function withErrorHandler(handler: RequestHandler): RequestHandler {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'API Error',
            code: error.code,
            statusCode: error.statusCode,
          }),
        );
        return error.toResponse();
      }

      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Unhandled error',
          name: error instanceof Error ? error.name : 'Unknown',
          detail: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );

      return Errors.internal().toResponse();
    }
  };
}
