import { describe, it, expect } from 'vitest';
import { parseFormatParam, InvalidFormatError } from './format';

function urlWith(params: string): URL {
  return new URL(`https://example.com/api?${params}`);
}

describe('parseFormatParam', () => {
  it('defaults to json when no format param', () => {
    expect(parseFormatParam(urlWith('repo=a/b'))).toEqual({ format: 'json' });
  });

  it('defaults to json when format param is empty', () => {
    expect(parseFormatParam(urlWith('format='))).toEqual({ format: 'json' });
  });

  it('returns json for format=json', () => {
    expect(parseFormatParam(urlWith('format=json'))).toEqual({ format: 'json' });
  });

  it('normalizes uppercase format=JSON to json', () => {
    expect(parseFormatParam(urlWith('format=JSON'))).toEqual({ format: 'json' });
  });

  it('normalizes mixed case format=Json to json', () => {
    expect(parseFormatParam(urlWith('format=Json'))).toEqual({ format: 'json' });
  });

  it('returns csv for format=csv', () => {
    expect(parseFormatParam(urlWith('format=csv'))).toEqual({ format: 'csv' });
  });

  it('throws InvalidFormatError for unsupported format', () => {
    expect(() => parseFormatParam(urlWith('format=xml'))).toThrow(InvalidFormatError);
  });

  it('includes format name in error message', () => {
    expect(() => parseFormatParam(urlWith('format=xml'))).toThrow('Unsupported format: xml');
  });

  it('throws for format=yaml', () => {
    expect(() => parseFormatParam(urlWith('format=yaml'))).toThrow(InvalidFormatError);
  });
});
