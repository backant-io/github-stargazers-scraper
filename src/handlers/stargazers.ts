import { validateRepoIdentifier } from '../utils/validation';
import { createErrorResponse } from '../types/errors';
import { getStargazers, StargazerError } from '../services/stargazers';
import { Env } from '../types';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;

export async function handleStargazers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');

  const validation = validateRepoIdentifier(repo);
  if (!validation.valid) {
    return createErrorResponse('INVALID_REPO', validation.error!, 400);
  }

  const trimmed = repo!.trim();
  const [owner, repoName] = trimmed.split('/');

  const page = parsePositiveInt(url.searchParams.get('page'), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(url.searchParams.get('per_page'), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );

  if (!env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'GitHub token not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const result = await getStargazers(env.GITHUB_TOKEN, owner, repoName, page, perPage);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof StargazerError) {
      const statusCode = error.code === 'REPO_NOT_FOUND' ? 404 : 422;
      return createErrorResponse(error.code, error.message, statusCode);
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

function parsePositiveInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? defaultValue : parsed;
}
