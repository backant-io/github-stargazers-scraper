import { withRetry } from '../utils/retry';
import { createGitHubClient } from './github';
import { GitHubStargazersResponse, StargazerListResponse } from '../types/stargazers';

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
          }
        }
      }
    }
  }
`;

const MAX_PER_PAGE = 100;
const MAX_RESULTS = 1000;

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

export async function getStargazers(
  token: string,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): Promise<StargazerListResponse> {
  const clampedPerPage = Math.min(Math.max(1, perPage), MAX_PER_PAGE);
  const client = createGitHubClient(token);
  const { first, after } = pageToGraphQLParams(page, clampedPerPage);

  let data: GitHubStargazersResponse;
  try {
    data = await withRetry(() =>
      client<GitHubStargazersResponse>(STARGAZERS_QUERY, {
        owner,
        repo: repo,
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

  const totalStargazers = Math.min(data.repository.stargazerCount, MAX_RESULTS);
  const totalPages = Math.max(1, Math.ceil(totalStargazers / clampedPerPage));

  const stargazers = data.repository.stargazers.edges.map((edge) => ({
    username: edge.node.login,
    starred_at: edge.starredAt,
  }));

  return {
    repository: `${owner}/${repo}`,
    total_stargazers: totalStargazers,
    page,
    per_page: clampedPerPage,
    total_pages: totalPages,
    data: stargazers,
  };
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
