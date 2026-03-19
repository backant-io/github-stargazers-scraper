import {
  LogLevel,
  LogLevelPriority,
  type LogLevelType,
  type LogConfig,
  type RequestLogEntry,
} from '../types/logging';

export class Logger {
  private readonly minLevel: number;
  private readonly service: string;

  constructor(config: LogConfig) {
    this.minLevel = LogLevelPriority[config.level];
    this.service = config.service;
  }

  private shouldLog(level: LogLevelType): boolean {
    return LogLevelPriority[level] >= this.minLevel;
  }

  private formatEntry(level: LogLevelType, entry: Partial<RequestLogEntry>): string {
    return JSON.stringify({
      service: this.service,
      timestamp: new Date().toISOString(),
      level,
      request_id: entry.request_id || 'unknown',
      ...entry,
    });
  }

  debug(entry: Partial<RequestLogEntry>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatEntry(LogLevel.DEBUG, entry));
    }
  }

  info(entry: Partial<RequestLogEntry>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatEntry(LogLevel.INFO, entry));
    }
  }

  warn(entry: Partial<RequestLogEntry>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatEntry(LogLevel.WARN, entry));
    }
  }

  error(entry: Partial<RequestLogEntry>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatEntry(LogLevel.ERROR, entry));
    }
  }
}

export function createLogger(env: { LOG_LEVEL?: string }): Logger {
  const level = (env.LOG_LEVEL as LogLevelType) || LogLevel.INFO;
  return new Logger({
    level,
    service: 'github-stargazers-scraper',
  });
}
