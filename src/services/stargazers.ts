import { withRetry } from '../utils/retry';
import { createGitHubClient } from './github';
import { GitHubStargazersResponse, StargazerListResponse } from '../types/stargazers';
import { normalizeProfile } from './profiles';
import { processInBatches } from './batchProcessor';

const STARGAZERS_QUERY = `
  query GetStargazers($owner: String!, $repo: String!, $first: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      stargazerCount
      stargazers(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          starredAt
          node {
            login
            name
            email
            company
            location
            bio
            websiteUrl
            twitterUsername
            avatarUrl
          }
        }
      }
    }
  }
`;

const MAX_PER_PAGE = 100;
const GRAPHQL_CURSOR_LIMIT = 1000;
const MAX_STARGAZERS = 50_000;

export class StargazerError extends Error {
  constructor(
    public readonly code: 'REPO_NOT_FOUND' | 'PRIVATE_REPO',
    message: string,
  ) {
    super(message);
    this.name = 'StargazerError';
  }
}

function pageToGraphQLParams(
  page: number,
  perPage: number,
): { first: number; after: string | null } {
  const offset = (page - 1) * perPage;
  if (offset === 0) {
    return { first: perPage, after: null };
  }
  const cursorValue = `cursor:${offset - 1}`;
  return { first: perPage, after: btoa(cursorValue) };
}

function needsBatchProcessing(page: number, perPage: number, totalStargazers: number): boolean {
  const startIndex = (page - 1) * perPage;
  return startIndex >= GRAPHQL_CURSOR_LIMIT || totalStargazers > MAX_STARGAZERS;
}

export async function getStargazers(
  token: string,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
  startTime: number = Date.now(),
): Promise<StargazerListResponse> {
  const clampedPerPage = Math.min(Math.max(1, perPage), MAX_PER_PAGE);
  const client = createGitHubClient(token);

  let initialData: GitHubStargazersResponse;
  try {
    const { first, after } = pageToGraphQLParams(1, 1);
    initialData = await withRetry(() =>
      client<GitHubStargazersResponse>(STARGAZERS_QUERY, {
        owner,
        repo,
        first,
        after,
      }),
    );
  } catch (error: unknown) {
    if (isGraphQLNotFoundError(error)) {
      throw new StargazerError('PRIVATE_REPO', 'Repository is private or inaccessible');
    }
    throw error;
  }

  if (!initialData.repository) {
    throw new StargazerError('REPO_NOT_FOUND', `Repository "${owner}/${repo}" not found`);
  }

  const totalStargazers = initialData.repository.stargazerCount;

  if (needsBatchProcessing(page, clampedPerPage, totalStargazers)) {
    const result = await processInBatches(
      token,
      client,
      owner,
      repo,
      page,
      clampedPerPage,
      startTime,
    );

    const effectiveTotal = Math.min(result.totalStargazers, MAX_STARGAZERS);
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / clampedPerPage));

    const response: StargazerListResponse = {
      repository: `${owner}/${repo}`,
      total_stargazers: effectiveTotal,
      page,
      per_page: clampedPerPage,
      total_pages: totalPages,
      data: result.stargazers,
    };

    if (result.truncated) {
      response.truncated = true;
      response.truncation_reason = 'maximum_stargazers_exceeded';
    }
    if (result.warnings.length > 0) {
      response.warnings = result.warnings;
    }
    if (result.incomplete) {
      response.incomplete = true;
      response.resume_cursor = result.resumeCursor ?? undefined;
    }
    if (result.rateLimitStatus) {
      response.rate_limit = {
        remaining: result.rateLimitStatus.remaining,
        reset_at: result.rateLimitStatus.resetAt.toISOString(),
      };
    }

    return response;
  }

  const { first, after } = pageToGraphQLParams(page, clampedPerPage);

  let data: GitHubStargazersResponse;
  try {
    data = await withRetry(() =>
      client<GitHubStargazersResponse>(STARGAZERS_QUERY, {
        owner,
        repo,
        first,
        after,
      }),
    );
  } catch (error: unknown) {
    if (isGraphQLNotFoundError(error)) {
      throw new StargazerError('PRIVATE_REPO', 'Repository is private or inaccessible');
    }
    throw error;
  }

  if (!data.repository) {
    throw new StargazerError('REPO_NOT_FOUND', `Repository "${owner}/${repo}" not found`);
  }

  const effectiveTotal = Math.min(data.repository.stargazerCount, MAX_STARGAZERS);
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / clampedPerPage));
  const stargazers = data.repository.stargazers.edges.map((edge) => normalizeProfile(edge));
  const truncated = data.repository.stargazerCount > MAX_STARGAZERS;

  const response: StargazerListResponse = {
    repository: `${owner}/${repo}`,
    total_stargazers: effectiveTotal,
    page,
    per_page: clampedPerPage,
    total_pages: totalPages,
    data: stargazers,
  };

  if (truncated) {
    response.truncated = true;
    response.truncation_reason = 'maximum_stargazers_exceeded';
    response.warnings = [
      'Repository has more than 50,000 stargazers. Results truncated to first 50,000.',
    ];
  }

  return response;
}

function isGraphQLNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('not found') || msg.includes('forbidden')) {
      return true;
    }
  }
  const graphqlError = error as { errors?: Array<{ type?: string }> };
  if (graphqlError.errors) {
    return graphqlError.errors.some((e) => e.type === 'FORBIDDEN' || e.type === 'NOT_FOUND');
  }
  return false;
}
