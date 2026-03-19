import { describe, it, expect } from 'vitest';
import { buildJsonResponse } from './response';
import type { StargazerListResponse } from '../types/stargazers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseBody(response: Response): Promise<any> {
  return response.json();
}

function makeResponse(overrides: Partial<StargazerListResponse> = {}): StargazerListResponse {
  return {
    repository: 'owner/repo',
    total_stargazers: 1,
    page: 1,
    per_page: 100,
    total_pages: 1,
    data: [
      {
        username: 'johndoe',
        name: 'John Doe',
        email: null,
        company: null,
        location: null,
        bio: null,
        blog: null,
        twitter_username: null,
        profile_url: 'https://github.com/johndoe',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        starred_at: '2024-01-15T10:30:00.000Z',
      },
    ],
    rate_limit: {
      remaining: 4500,
      reset_at: '2024-01-15T11:00:00.000Z',
    },
    ...overrides,
  };
}

describe('buildJsonResponse', () => {
  it('sets Content-Type to application/json', async () => {
    const response = buildJsonResponse(makeResponse());
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns status 200', () => {
    const response = buildJsonResponse(makeResponse());
    expect(response.status).toBe(200);
  });

  it('includes all required fields in body', async () => {
    const response = buildJsonResponse(makeResponse());
    const body = await parseBody(response);
    expect(body).toHaveProperty('repository');
    expect(body).toHaveProperty('total_stargazers');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('per_page');
    expect(body).toHaveProperty('total_pages');
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('rate_limit');
  });

  it('preserves null fields in data', async () => {
    const response = buildJsonResponse(makeResponse());
    const body = await parseBody(response);
    const profile = body.data[0];
    expect(profile.email).toBeNull();
    expect(profile.company).toBeNull();
    expect(profile.location).toBeNull();
    expect(profile.bio).toBeNull();
    expect(profile.blog).toBeNull();
    expect(profile.twitter_username).toBeNull();
  });

  it('serializes null rate_limit', async () => {
    const response = buildJsonResponse(makeResponse({ rate_limit: null }));
    const body = await parseBody(response);
    expect(body.rate_limit).toBeNull();
    // Verify it's present as null, not omitted
    expect('rate_limit' in body).toBe(true);
  });

  it('preserves custom headers', () => {
    const headers = new Headers();
    headers.set('X-Custom', 'test');
    const response = buildJsonResponse(makeResponse(), headers);
    expect(response.headers.get('X-Custom')).toBe('test');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('includes truncated and warnings when present', async () => {
    const data = makeResponse({
      truncated: true,
      warnings: ['Repository has more than 50,000 stargazers.'],
    });
    const response = buildJsonResponse(data);
    const body = await parseBody(response);
    expect(body.truncated).toBe(true);
    expect(body.warnings).toEqual(['Repository has more than 50,000 stargazers.']);
  });

  it('uses ISO 8601 format for rate_limit.reset_at', async () => {
    const response = buildJsonResponse(makeResponse());
    const body = await parseBody(response);
    expect(body.rate_limit.reset_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('uses ISO 8601 format for starred_at', async () => {
    const response = buildJsonResponse(makeResponse());
    const body = await parseBody(response);
    expect(body.data[0].starred_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
