import { generateApiKey } from '../utils/apiKey';
import { hashApiKey } from '../utils/auth';
import { apiKeys } from '../db/schema';
import type { Database } from '../db';
import type { PlanType } from '../types/auth';
import type { ApiKeyCreateResult } from '../types/apiKeys';

export async function createApiKey(
  db: Database,
  userId: string,
  planType: PlanType = 'free',
): Promise<ApiKeyCreateResult> {
  const plaintext = generateApiKey();
  const keyHash = await hashApiKey(plaintext);

  const result = await db
    .insert(apiKeys)
    .values({
      userId,
      keyHash,
      planType,
    })
    .returning({
      id: apiKeys.id,
      createdAt: apiKeys.createdAt,
    });

  const row = result[0];

  return {
    id: row.id,
    plaintext,
    planType,
    createdAt: row.createdAt,
  };
}
