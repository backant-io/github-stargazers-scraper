import { validateRepoIdentifier } from '../utils/validation';
import { createErrorResponse } from '../types/errors';
import { getStargazers, StargazerError } from '../services/stargazers';
import { RateLimitError } from '../utils/rateLimit';
import { parsePaginationParams } from '../utils/pagination';
import { Env } from '../types';

export async function handleStargazers(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
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

  try {
    const result = await getStargazers(
      env.GITHUB_TOKEN,
      owner,
      repoName,
      pagination.page,
      pagination.perPage,
      startTime,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (pagination.wasPerPageCapped) {
      headers['X-Per-Page-Capped'] = 'true';
      headers['X-Per-Page-Requested'] = String(pagination.originalPerPage);
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
      headers['X-Partial-Response'] = 'true';
    }
    if (result.resume_cursor) {
      headers['X-Next-Cursor'] = result.resume_cursor;
    }
    if (result.rate_limit) {
      headers['X-RateLimit-Remaining'] = String(result.rate_limit.remaining);
      headers['X-RateLimit-Reset'] = result.rate_limit.reset_at;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    });
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
