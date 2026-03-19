export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 100,
  MIN_PAGE: 1,
  MIN_PER_PAGE: 1,
  MAX_PER_PAGE: 500,
  MAX_STARGAZERS: 50_000,
} as const;

export interface PaginationParams {
  page: number;
  perPage: number;
  wasPerPageCapped: boolean;
  originalPerPage?: number;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_pages: number;
  total_stargazers: number;
}

export function parsePaginationParams(url: URL): PaginationParams {
  const pageStr = url.searchParams.get('page');
  const perPageStr = url.searchParams.get('per_page');

  let page = parseInt(pageStr || '', 10);
  if (isNaN(page) || page < PAGINATION.MIN_PAGE) {
    page = PAGINATION.DEFAULT_PAGE;
  }

  let perPage = parseInt(perPageStr || '', 10);
  const originalPerPage = perPage;

  if (isNaN(perPage) || perPage < PAGINATION.MIN_PER_PAGE) {
    perPage = PAGINATION.DEFAULT_PER_PAGE;
  }

  const wasPerPageCapped = perPage > PAGINATION.MAX_PER_PAGE;
  if (wasPerPageCapped) {
    perPage = PAGINATION.MAX_PER_PAGE;
  }

  return {
    page,
    perPage,
    wasPerPageCapped,
    originalPerPage: wasPerPageCapped ? originalPerPage : undefined,
  };
}

export function calculatePaginationMeta(
  totalStargazers: number,
  page: number,
  perPage: number,
): PaginationMeta {
  const effectiveTotal = Math.min(totalStargazers, PAGINATION.MAX_STARGAZERS);
  const totalPages = effectiveTotal === 0 ? 0 : Math.ceil(effectiveTotal / perPage);

  return {
    page,
    per_page: perPage,
    total_pages: totalPages,
    total_stargazers: totalStargazers,
  };
}
