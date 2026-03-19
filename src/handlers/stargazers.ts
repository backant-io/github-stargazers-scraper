import { validateRepoIdentifier } from '../utils/validation';
import { createErrorResponse, createGitHubRateLimitResponse } from '../types/errors';
import { getStargazers, StargazerError } from '../services/stargazers';
import { RateLimitError } from '../utils/rateLimit';
import { parsePaginationParams } from '../utils/pagination';
import { parseFormatParam, InvalidFormatError } from '../utils/format';
import { buildJsonResponse } from '../utils/response';
import { buildCsvResponse } from '../utils/csv';
import { formatIsoDate } from '../utils/date';
import { Env } from '../types';
import type { AuthContext } from '../types/auth';
import type { StargazerListResponse } from '../types/stargazers';
import { createRedisClient } from '../services/redis';
import { checkGitHubRateLimit } from '../services/github-ratelimit';
import { getStargazersFromCache, cacheStargazers } from '../services/cache';

export async function handleStargazers(
  request: Request,
  env: Env,
  _authContext: AuthContext,
): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);

  let formatParams;
  try {
    formatParams = parseFormatParam(url);
  } catch (error) {
    if (error instanceof InvalidFormatError) {
      return createErrorResponse('INVALID_FORMAT', error.message, 400);
    }
    throw error;
  }

  const repo = url.searchParams.get('repo');

  const validation = validateRepoIdentifier(repo);
  if (!validation.valid) {
    return createErrorResponse('INVALID_REPO', validation.error!, 400);
  }

  const trimmed = repo!.trim();
  const [owner, repoName] = trimmed.split('/');

  const pagination = parsePaginationParams(url);

  if (!env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'GitHub token not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const redis = createRedisClient(env);

  // Check cache first for fast responses
  if (redis) {
    try {
      const cacheResult = await getStargazersFromCache(
        redis,
        owner,
        repoName,
        pagination.page,
        pagination.perPage,
      );

      if (cacheResult.hit && cacheResult.data) {
        const headers = new Headers();
        headers.set('X-Cache', 'HIT');
        if (cacheResult.age !== undefined) {
          headers.set('X-Cache-Age', String(cacheResult.age));
        }

        if (pagination.wasPerPageCapped) {
          headers.set('X-Per-Page-Capped', 'true');
          headers.set('X-Per-Page-Requested', String(pagination.originalPerPage));
        }

        switch (formatParams.format) {
          case 'json':
            return buildJsonResponse(cacheResult.data, headers);
          case 'csv':
            return buildCsvResponse(cacheResult.data.data, owner, repoName, headers);
          default:
            return createErrorResponse('INVALID_FORMAT', 'Unknown format', 400);
        }
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          message: 'Cache lookup failed, proceeding to fetch',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }

  // Check GitHub rate limit before making API calls
  if (redis) {
    try {
      const githubRateCheck = await checkGitHubRateLimit(redis, false);

      if (githubRateCheck.warning) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: githubRateCheck.warning,
          }),
        );
      }

      switch (githubRateCheck.action) {
        case 'reject':
          return createGitHubRateLimitResponse(
            githubRateCheck.retryAfter!,
            githubRateCheck.state!.resetAt,
          );

        case 'proceed':
        case 'queue':
        case 'use_cache':
          break;
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          message: 'Failed to check GitHub rate limit state, proceeding',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }

  try {
    const result = await getStargazers(
      env.GITHUB_TOKEN,
      owner,
      repoName,
      pagination.page,
      pagination.perPage,
      startTime,
      redis,
    );

    const headers = new Headers();
    headers.set('X-Cache', 'MISS');

    if (pagination.wasPerPageCapped) {
      headers.set('X-Per-Page-Capped', 'true');
      headers.set('X-Per-Page-Requested', String(pagination.originalPerPage));
      console.log(
        JSON.stringify({
          level: 'warn',
          message: 'per_page capped to maximum',
          requested: pagination.originalPerPage,
          capped_to: pagination.perPage,
        }),
      );
    }

    if (result.incomplete) {
      headers.set('X-Partial-Response', 'true');
    }
    if (result.resume_cursor) {
      headers.set('X-Next-Cursor', result.resume_cursor);
    }
    if (result.rate_limit) {
      headers.set('X-RateLimit-Remaining', String(result.rate_limit.remaining));
      headers.set('X-RateLimit-Reset', result.rate_limit.reset_at);
    }

    // Ensure rate_limit.reset_at is ISO 8601 formatted
    const responseData: StargazerListResponse = {
      ...result,
      rate_limit: result.rate_limit
        ? {
            remaining: result.rate_limit.remaining,
            reset_at: formatIsoDate(result.rate_limit.reset_at),
          }
        : null,
    };

    // Cache the response (fire-and-forget)
    if (redis) {
      cacheStargazers(
        redis,
        owner,
        repoName,
        pagination.page,
        pagination.perPage,
        responseData,
      ).catch((err) => {
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'Failed to cache stargazer data',
            error: err instanceof Error ? err.message : 'Unknown error',
          }),
        );
      });
    }

    switch (formatParams.format) {
      case 'json':
        return buildJsonResponse(responseData, headers);
      case 'csv':
        return buildCsvResponse(result.data, owner, repoName, headers);
      default:
        return createErrorResponse('INVALID_FORMAT', 'Unknown format', 400);
    }
  } catch (error) {
    if (error instanceof StargazerError) {
      const statusCode = error.code === 'REPO_NOT_FOUND' ? 404 : 422;
      return createErrorResponse(error.code, error.message, statusCode);
    }
    if (error instanceof RateLimitError) {
      return createErrorResponse('GITHUB_RATE_LIMIT', error.message, 429);
    }
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to fetch stargazers',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return new Response(
      JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
