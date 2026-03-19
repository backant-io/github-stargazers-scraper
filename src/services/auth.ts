import { eq } from 'drizzle-orm';
import { apiKeys } from '../db/schema';
import type { Database } from '../db';
import type { ApiKeyRecord } from '../types/auth';

export async function lookupApiKey(db: Database, keyHash: string): Promise<ApiKeyRecord | null> {
  const results = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);

  if (results.length === 0) {
    return null;
  }

  const row = results[0];

  if (row.revokedAt !== null) {
    return null;
  }

  if (row.expiresAt !== null && row.expiresAt <= new Date()) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.userId,
    key_hash: row.keyHash,
    plan_type: row.planType as ApiKeyRecord['plan_type'],
    created_at: row.createdAt,
    expires_at: row.expiresAt,
    revoked_at: row.revokedAt,
  };
}
