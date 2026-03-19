import type { StargazerProfile } from '../types/stargazers';

export const CSV_HEADERS = [
  'username',
  'name',
  'email',
  'company',
  'location',
  'bio',
  'blog',
  'twitter_username',
  'profile_url',
  'starred_at',
] as const;

export type CSVColumnKey = (typeof CSV_HEADERS)[number];

const UTF8_BOM = '\uFEFF';
const CRLF = '\r\n';

export function escapeCSVField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  const needsQuoting =
    str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');

  if (!needsQuoting) {
    return str;
  }

  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function formatCSVRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeCSVField).join(',');
}

export function stargazerToCSVRow(profile: StargazerProfile): (string | null)[] {
  return [
    profile.username,
    profile.name,
    profile.email,
    profile.company,
    profile.location,
    profile.bio,
    profile.blog,
    profile.twitter_username,
    profile.profile_url,
    profile.starred_at,
  ];
}

export function generateCSVContent(profiles: StargazerProfile[]): string {
  let csv = UTF8_BOM;

  csv += formatCSVRow([...CSV_HEADERS]) + CRLF;

  for (const profile of profiles) {
    const rowData = stargazerToCSVRow(profile);
    csv += formatCSVRow(rowData) + CRLF;
  }

  return csv;
}

export function buildCsvResponse(
  profiles: StargazerProfile[],
  owner: string,
  repo: string,
  headers: Headers = new Headers(),
): Response {
  const csvContent = generateCSVContent(profiles);

  const safeOwner = owner.replace(/[^a-zA-Z0-9-_]/g, '');
  const safeRepo = repo.replace(/[^a-zA-Z0-9-_]/g, '');
  const filename = `stargazers-${safeOwner}-${safeRepo}.csv`;

  headers.set('Content-Type', 'text/csv; charset=utf-8');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);

  return new Response(csvContent, {
    status: 200,
    headers,
  });
}
