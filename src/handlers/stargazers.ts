import { validateRepoIdentifier } from '../utils/validation';
import { createErrorResponse } from '../types/errors';

export async function handleStargazers(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');

  const validation = validateRepoIdentifier(repo);
  if (!validation.valid) {
    return createErrorResponse('INVALID_REPO', validation.error!, 400);
  }

  return new Response(JSON.stringify({ message: 'Not implemented yet', repo: repo!.trim() }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}
