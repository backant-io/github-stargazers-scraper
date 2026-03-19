import { graphql } from '@octokit/graphql';
import { withRetry } from '../utils/retry';
import { TestConnectionResult } from '../types/github';
import type { DependencyCheckResult } from '../types/health';

const TEST_QUERY = `
  query TestConnection($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
      stargazerCount
    }
    rateLimit {
      remaining
      resetAt
    }
  }
`;

interface TestQueryResponse {
  repository: {
    name: string;
    stargazerCount: number;
  };
  rateLimit: {
    remaining: number;
    resetAt: string;
  };
}

export function createGitHubClient(token: string): typeof graphql {
  return graphql.defaults({
    headers: {
      authorization: `bearer ${token}`,
    },
    request: {
      timeout: 30000,
    },
  });
}

export async function testGitHubConnection(
  client: typeof graphql,
  owner: string = 'octocat',
  repo: string = 'Hello-World',
): Promise<TestConnectionResult> {
  const response = await withRetry(() => client<TestQueryResponse>(TEST_QUERY, { owner, repo }));

  return {
    repositoryName: response.repository.name,
    stargazerCount: response.repository.stargazerCount,
    rateLimit: {
      remaining: response.rateLimit.remaining,
      resetAt: response.rateLimit.resetAt,
    },
  };
}

export async function checkGitHubHealth(token: string | undefined): Promise<DependencyCheckResult> {
  if (!token) {
    return { status: 'error', latencyMs: 0, error: 'GITHUB_TOKEN not configured' };
  }

  const start = Date.now();
  try {
    const client = createGitHubClient(token);
    await testGitHubConnection(client);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'GitHub health check failed',
        error: message,
      }),
    );
    return { status: 'error', latencyMs: Date.now() - start, error: message };
  }
}
