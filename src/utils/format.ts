export type ResponseFormat = 'json' | 'csv';

export const SUPPORTED_FORMATS: ResponseFormat[] = ['json', 'csv'];

export class InvalidFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFormatError';
  }
}

export interface FormatParams {
  format: ResponseFormat;
}

export function parseFormatParam(url: URL): FormatParams {
  const formatStr = url.searchParams.get('format');

  if (!formatStr || formatStr.trim() === '') {
    return { format: 'json' };
  }

  const normalized = formatStr.toLowerCase().trim();

  if (!SUPPORTED_FORMATS.includes(normalized as ResponseFormat)) {
    throw new InvalidFormatError(
      `Unsupported format: ${formatStr}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
    );
  }

  return { format: normalized as ResponseFormat };
}
