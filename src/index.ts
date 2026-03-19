import { handleHealth } from './handlers/health';
import { handleStargazers } from './handlers/stargazers';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return handleHealth(env);
    }

    if (url.pathname === '/api/v1/stargazers' && request.method === 'GET') {
      return handleStargazers(request);
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;
