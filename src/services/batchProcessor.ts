import { graphql } from '@octokit/graphql';
import { withRetry } from '../utils/retry';
import { ensureRateLimit, RateLimitStatus } from '../utils/rateLimit';
import {
  GitHubStargazersResponse,
  GitHubRESTStargazer,
  StargazerProfile,
} from '../types/stargazers';
import { normalizeProfile } from './profiles';

const MAX_STARGAZERS = 50_000;
const GRAPHQL_CURSOR_LIMIT = 1000;
const BATCH_SIZE = 100;
const TIMEOUT_BUFFER_MS = 28_000;

export interface BatchProcessResult {
  stargazers: StargazerProfile[];
  totalStargazers: number;
  truncated: boolean;
  incomplete: boolean;
  resumeCursor: string | null;
  warnings: string[];
  rateLimitStatus: RateLimitStatus | null;
}

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

function graphqlCursor(offset: number): string | null {
  if (offset === 0) return null;
  return btoa(`cursor:${offset - 1}`);
}

async function fetchGraphQLPage(
  client: typeof graphql,
  owner: string,
  repo: string,
  offset: number,
  count: number,
): Promise<GitHubStargazersResponse> {
  return withRetry(() =>
    client<GitHubStargazersResponse>(STARGAZERS_QUERY, {
      owner,
      repo,
      first: count,
      after: graphqlCursor(offset),
    }),
  );
}

async function fetchRESTPage(
  token: string,
  owner: string,
  repo: string,
  page: number,
): Promise<StargazerProfile[]> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stargazers?per_page=${BATCH_SIZE}&page=${page}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.star+json',
        'User-Agent': 'github-stargazers-scraper',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub REST API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GitHubRESTStargazer[];

  return data.map((item) => ({
    username: item.user.login,
    name: null,
    email: null,
    company: null,
    location: null,
    bio: null,
    blog: null,
    twitter_username: null,
    profile_url: `https://github.com/${item.user.login}`,
    avatar_url: item.user.avatar_url,
    starred_at: item.starred_at,
  }));
}

export async function processInBatches(
  token: string,
  client: typeof graphql,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
  startTime: number,
): Promise<BatchProcessResult> {
  const warnings: string[] = [];
  let rateLimitStatus: RateLimitStatus | null = null;

  const initialData = await fetchGraphQLPage(client, owner, repo, 0, 1);

  if (!initialData.repository) {
    throw new Error(`Repository "${owner}/${repo}" not found`);
  }

  const actualTotal = initialData.repository.stargazerCount;
  const truncated = actualTotal > MAX_STARGAZERS;
  const effectiveTotal = Math.min(actualTotal, MAX_STARGAZERS);

  if (truncated) {
    warnings.push(`Repository has more than 50,000 stargazers. Results truncated to first 50,000.`);
  }

  const startIndex = (page - 1) * perPage;

  if (startIndex >= effectiveTotal) {
    return {
      stargazers: [],
      totalStargazers: actualTotal,
      truncated,
      incomplete: false,
      resumeCursor: null,
      warnings,
      rateLimitStatus,
    };
  }

  const endIndex = Math.min(startIndex + perPage, effectiveTotal);
  const needed = endIndex - startIndex;
  const stargazers: StargazerProfile[] = [];

  if (startIndex < GRAPHQL_CURSOR_LIMIT) {
    const graphqlEnd = Math.min(endIndex, GRAPHQL_CURSOR_LIMIT);
    const graphqlCount = graphqlEnd - startIndex;

    let offset = startIndex;
    while (offset < graphqlEnd) {
      if (Date.now() - startTime > TIMEOUT_BUFFER_MS) {
        return buildIncompleteResult(
          stargazers,
          actualTotal,
          truncated,
          offset,
          warnings,
          rateLimitStatus,
        );
      }

      rateLimitStatus = await ensureRateLimit(token);

      const fetchCount = Math.min(BATCH_SIZE, graphqlEnd - offset);
      const data = await fetchGraphQLPage(client, owner, repo, offset, fetchCount);

      if (!data.repository) break;

      const profiles = data.repository.stargazers.edges.map((edge) => normalizeProfile(edge));
      stargazers.push(...profiles);
      offset += profiles.length;

      if (!data.repository.stargazers.pageInfo.hasNextPage || profiles.length === 0) break;

      logBatchProgress(offset, graphqlCount, 'graphql');
    }
  }

  if (endIndex > GRAPHQL_CURSOR_LIMIT && stargazers.length < needed) {
    const restStart = Math.max(startIndex, GRAPHQL_CURSOR_LIMIT);
    const restStartPage = Math.floor(restStart / BATCH_SIZE) + 1;
    const restEndPage = Math.ceil(endIndex / BATCH_SIZE);

    for (let restPage = restStartPage; restPage <= restEndPage; restPage++) {
      if (Date.now() - startTime > TIMEOUT_BUFFER_MS) {
        const processed = startIndex + stargazers.length;
        return buildIncompleteResult(
          stargazers,
          actualTotal,
          truncated,
          processed,
          warnings,
          rateLimitStatus,
        );
      }

      rateLimitStatus = await ensureRateLimit(token);

      const profiles = await withRetry(() => fetchRESTPage(token, owner, repo, restPage));

      if (profiles.length === 0) break;

      const pageStart = (restPage - 1) * BATCH_SIZE;
      const sliceStart = Math.max(0, restStart - pageStart);
      const sliceEnd = Math.min(profiles.length, endIndex - pageStart);
      const relevant = profiles.slice(sliceStart, sliceEnd);

      stargazers.push(...relevant);

      logBatchProgress(startIndex + stargazers.length, needed, 'rest');

      if (stargazers.length >= needed) break;
    }
  }

  return {
    stargazers: stargazers.slice(0, needed),
    totalStargazers: actualTotal,
    truncated,
    incomplete: false,
    resumeCursor: null,
    warnings,
    rateLimitStatus,
  };
}

function buildIncompleteResult(
  stargazers: StargazerProfile[],
  actualTotal: number,
  truncated: boolean,
  processedUpTo: number,
  warnings: string[],
  rateLimitStatus: RateLimitStatus | null,
): BatchProcessResult {
  warnings.push('Request timeout approaching. Partial results returned.');
  return {
    stargazers,
    totalStargazers: actualTotal,
    truncated,
    incomplete: true,
    resumeCursor: btoa(`cursor:${processedUpTo - 1}`),
    warnings,
    rateLimitStatus,
  };
}

function logBatchProgress(current: number, total: number, source: string): void {
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Batch progress',
      source,
      current,
      total,
    }),
  );
}
