export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

export const LogLevelPriority: Record<LogLevelType, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface RequestLogEntry {
  timestamp: string;
  request_id: string;
  level: LogLevelType;
  method: string;
  path: string;
  query_params?: Record<string, string>;
  api_key_id?: string;
  status_code?: number;
  response_time_ms?: number;
  cache_status?: 'HIT' | 'MISS' | 'BYPASS';
  error_code?: string;
  error_message?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface LogConfig {
  level: LogLevelType;
  service: string;
}
