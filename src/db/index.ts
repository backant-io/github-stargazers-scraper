import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import type { DependencyCheckResult } from '../types/health';

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({
    connectionString,
    max: 5,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return drizzle(pool, { schema });
}

export async function checkDatabaseHealth(db: Database | null): Promise<DependencyCheckResult> {
  if (!db) {
    return { status: 'error', latencyMs: 0, error: 'Database not configured' };
  }

  const start = Date.now();
  try {
    await db.execute('SELECT 1');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database connection failed';
    return { status: 'error', latencyMs: Date.now() - start, error: message };
  }
}

export { schema };
