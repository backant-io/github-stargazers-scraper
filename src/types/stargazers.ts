export interface StargazerProfile {
  username: string;
  name: string | null;
  email: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  blog: string | null;
  twitter_username: string | null;
  profile_url: string;
  avatar_url: string;
  starred_at: string;
}

export type { PaginationMeta, PaginationParams } from '../utils/pagination';

export interface StargazerListResponse {
  repository: string;
  page: number;
  per_page: number;
  total_pages: number;
  total_stargazers: number;
  data: StargazerProfile[];
  truncated?: boolean;
  truncation_reason?: 'maximum_stargazers_exceeded';
  warnings?: string[];
  incomplete?: boolean;
  resume_cursor?: string;
  rate_limit: {
    remaining: number;
    reset_at: string;
  } | null;
}

export interface GitHubStargazerNode {
  login: string;
  name: string | null;
  email: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  websiteUrl: string | null;
  twitterUsername: string | null;
  avatarUrl: string;
}

export interface GitHubStargazerEdge {
  starredAt: string;
  node: GitHubStargazerNode | null;
}

export interface GitHubRESTStargazer {
  user: {
    login: string;
    avatar_url: string;
  };
  starred_at: string;
}

export interface GitHubRateLimitResponse {
  limit: number;
  remaining: number;
  resetAt: string;
  cost: number;
}

export interface GitHubStargazersResponse {
  repository: {
    stargazerCount: number;
    stargazers: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      edges: GitHubStargazerEdge[];
    };
  } | null;
  rateLimit?: GitHubRateLimitResponse;
}
