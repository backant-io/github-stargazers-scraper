import { HealthResponse } from '../types';

export function handleHealth(): Response {
  const body: HealthResponse = {
    status: 'healthy',
    version: '1.0.0',
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
