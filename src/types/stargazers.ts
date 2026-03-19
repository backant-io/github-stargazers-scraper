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

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_pages: number;
  total_stargazers: number;
}

export interface StargazerListResponse extends PaginationMeta {
  repository: string;
  data: StargazerProfile[];
  truncated?: boolean;
  truncation_reason?: 'maximum_stargazers_exceeded';
  warnings?: string[];
  incomplete?: boolean;
  resume_cursor?: string;
  rate_limit?: {
    remaining: number;
    reset_at: string;
  };
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
}
