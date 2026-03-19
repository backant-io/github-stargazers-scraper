import { describe, it, expect } from 'vitest';
import {
  escapeCSVField,
  formatCSVRow,
  stargazerToCSVRow,
  generateCSVContent,
  buildCsvResponse,
  CSV_HEADERS,
} from './csv';
import type { StargazerProfile } from '../types/stargazers';

describe('escapeCSVField', () => {
  it('returns empty string for null', () => {
    expect(escapeCSVField(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCSVField(undefined)).toBe('');
  });

  it('returns simple text unchanged', () => {
    expect(escapeCSVField('simple')).toBe('simple');
  });

  it('wraps field with comma in double quotes', () => {
    expect(escapeCSVField('Acme, Inc.')).toBe('"Acme, Inc."');
  });

  it('escapes double quotes by doubling them', () => {
    expect(escapeCSVField('has"quote')).toBe('"has""quote"');
  });

  it('wraps field with newline in double quotes', () => {
    expect(escapeCSVField('line\nbreak')).toBe('"line\nbreak"');
  });

  it('wraps field with carriage return in double quotes', () => {
    expect(escapeCSVField('line\rbreak')).toBe('"line\rbreak"');
  });

  it('handles combo of comma and quotes', () => {
    expect(escapeCSVField('combo,"test"')).toBe('"combo,""test"""');
  });

  it('preserves unicode characters', () => {
    expect(escapeCSVField('Tokyo 🇯🇵')).toBe('Tokyo 🇯🇵');
  });

  it('returns empty string unchanged', () => {
    expect(escapeCSVField('')).toBe('');
  });
});

describe('formatCSVRow', () => {
  it('joins simple fields with commas', () => {
    expect(formatCSVRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('handles null fields as empty strings', () => {
    expect(formatCSVRow(['a', null, 'c'])).toBe('a,,c');
  });

  it('escapes fields that need quoting', () => {
    expect(formatCSVRow(['hello', 'world, yes', 'done'])).toBe('hello,"world, yes",done');
  });
});

const makeProfile = (overrides: Partial<StargazerProfile> = {}): StargazerProfile => ({
  username: 'johndoe',
  name: 'John Doe',
  email: null,
  company: 'Acme, Inc.',
  location: 'SF',
  bio: null,
  blog: 'https://john.dev',
  twitter_username: 'johndoe',
  profile_url: 'https://github.com/johndoe',
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  starred_at: '2024-01-15T10:30:00Z',
  ...overrides,
});

describe('stargazerToCSVRow', () => {
  it('returns array with 10 elements in correct order', () => {
    const row = stargazerToCSVRow(makeProfile());
    expect(row).toHaveLength(10);
    expect(row[0]).toBe('johndoe');
    expect(row[1]).toBe('John Doe');
    expect(row[2]).toBeNull(); // email
    expect(row[3]).toBe('Acme, Inc.');
    expect(row[4]).toBe('SF');
    expect(row[5]).toBeNull(); // bio
    expect(row[6]).toBe('https://john.dev');
    expect(row[7]).toBe('johndoe');
    expect(row[8]).toBe('https://github.com/johndoe');
    expect(row[9]).toBe('2024-01-15T10:30:00Z');
  });

  it('does not include avatar_url in the row', () => {
    const row = stargazerToCSVRow(makeProfile());
    expect(row).not.toContain('https://avatars.githubusercontent.com/u/1');
  });
});

describe('generateCSVContent', () => {
  it('starts with UTF-8 BOM', () => {
    const csv = generateCSVContent([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('has header row as first line after BOM', () => {
    const csv = generateCSVContent([]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(
      'username,name,email,company,location,bio,blog,twitter_username,profile_url,starred_at',
    );
  });

  it('uses CRLF line endings', () => {
    const csv = generateCSVContent([makeProfile()]);
    // Remove BOM, then check for \r\n
    const content = csv.slice(1);
    const crlfCount = (content.match(/\r\n/g) || []).length;
    // Header + 1 data row = 2 CRLF endings
    expect(crlfCount).toBe(2);
  });

  it('correctly escapes fields with commas in data rows', () => {
    const csv = generateCSVContent([makeProfile()]);
    const lines = csv.slice(1).split('\r\n');
    // Data row should have "Acme, Inc." quoted
    expect(lines[1]).toContain('"Acme, Inc."');
  });

  it('represents null values as empty strings', () => {
    const csv = generateCSVContent([makeProfile({ email: null, bio: null })]);
    const lines = csv.slice(1).split('\r\n');
    const fields = parseCSVRow(lines[1]);
    expect(fields[2]).toBe(''); // email
    expect(fields[5]).toBe(''); // bio
  });

  it('every data row has exactly 10 fields', () => {
    const profiles = [makeProfile(), makeProfile({ username: 'janedoe', company: null })];
    const csv = generateCSVContent(profiles);
    const lines = csv.slice(1).split('\r\n').filter(Boolean);
    for (const line of lines) {
      const fields = parseCSVRow(line);
      expect(fields).toHaveLength(10);
    }
  });

  it('handles profiles with newlines in bio', () => {
    const csv = generateCSVContent([makeProfile({ bio: 'Line1\nLine2' })]);
    expect(csv).toContain('"Line1\nLine2"');
  });
});

describe('buildCsvResponse', () => {
  it('sets Content-Type to text/csv', () => {
    const response = buildCsvResponse([makeProfile()], 'owner', 'repo');
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  });

  it('sets Content-Disposition with correct filename', () => {
    const response = buildCsvResponse([makeProfile()], 'myorg', 'myrepo');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="stargazers-myorg-myrepo.csv"',
    );
  });

  it('sanitizes owner/repo in filename', () => {
    const response = buildCsvResponse([makeProfile()], 'my org!', 'my@repo');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="stargazers-myorg-myrepo.csv"',
    );
  });

  it('preserves extra headers passed in', () => {
    const headers = new Headers();
    headers.set('X-Custom', 'value');
    const response = buildCsvResponse([makeProfile()], 'o', 'r', headers);
    expect(response.headers.get('X-Custom')).toBe('value');
  });

  it('returns status 200', () => {
    const response = buildCsvResponse([], 'o', 'r');
    expect(response.status).toBe(200);
  });

  it('body parses as valid CSV with correct column count', async () => {
    const response = buildCsvResponse(
      [makeProfile(), makeProfile({ username: 'jane' })],
      'o',
      'r',
    );
    const text = await response.text();
    const content = text.slice(1); // Remove BOM
    const lines = content.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 data rows
    for (const line of lines) {
      const fields = parseCSVRow(line);
      expect(fields).toHaveLength(10);
    }
  });
});

describe('CSV_HEADERS', () => {
  it('has exactly 10 columns', () => {
    expect(CSV_HEADERS).toHaveLength(10);
  });

  it('matches expected column order', () => {
    expect([...CSV_HEADERS]).toEqual([
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
    ]);
  });
});

// Simple RFC 4180 CSV row parser for test assertions
function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < row.length) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}
