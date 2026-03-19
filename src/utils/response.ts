import type { StargazerListResponse } from '../types/stargazers';

export function buildJsonResponse(
  data: StargazerListResponse,
  headers: Headers = new Headers(),
): Response {
  headers.set('Content-Type', 'application/json');

  const body = JSON.stringify(data);

  return new Response(body, {
    status: 200,
    headers,
  });
}
