export interface StargazerBasic {
  username: string;
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
  data: StargazerBasic[];
}

export interface GitHubStargazersResponse {
  repository: {
    stargazerCount: number;
    stargazers: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      edges: Array<{
        starredAt: string;
        node: {
          login: string;
        };
      }>;
    };
  } | null;
}
