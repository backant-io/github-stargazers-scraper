import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { generateApiKey } from '../utils/apiKey';
import { hashApiKey } from '../utils/auth';
import { apiKeys } from '../db/schema';
import type { Database } from '../db';
import type {
  KeyRotationResult,
  KeyRotationError,
  KeyRevocationResult,
  KeyRevocationError,
} from '../types/key-rotation';

const GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

export async function rotateApiKey(
  db: Database,
  userId: string,
): Promise<KeyRotationResult | KeyRotationError> {
  const newPlaintextKey = generateApiKey();
  const newKeyHash = await hashApiKey(newPlaintextKey);

  try {
    const currentKeys = await db
      .select({ id: apiKeys.id, planType: apiKeys.planType })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, userId),
          isNull(apiKeys.revokedAt),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
        ),
      )
      .limit(1);

    if (currentKeys.length === 0) {
      return { success: false, error: 'NO_EXISTING_KEY' };
    }

    const { planType } = currentKeys[0];
    const graceExpiresAt = new Date(Date.now() + GRACE_PERIOD_MS);

    // Set expiration on all current active keys (grace period)
    await db
      .update(apiKeys)
      .set({ expiresAt: graceExpiresAt })
      .where(
        and(
          eq(apiKeys.userId, userId),
          isNull(apiKeys.revokedAt),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, graceExpiresAt)),
        ),
      );

    // Insert new key
    const newKeyResult = await db
      .insert(apiKeys)
      .values({
        userId,
        keyHash: newKeyHash,
        planType,
      })
      .returning({ id: apiKeys.id });

    return {
      success: true,
      apiKey: newPlaintextKey,
      keyId: newKeyResult[0].id,
      expiresOldKeyAt: graceExpiresAt,
    };
  } catch (error) {
    console.error('Key rotation failed:', error);
    return { success: false, error: 'DATABASE_ERROR' };
  }
}

export async function revokeApiKey(
  db: Database,
  keyId: string,
  userId: string,
): Promise<KeyRevocationResult | KeyRevocationError> {
  try {
    const keyCheck = await db
      .select({ userId: apiKeys.userId, revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (keyCheck.length === 0) {
      return { success: false, error: 'KEY_NOT_FOUND' };
    }

    const key = keyCheck[0];

    if (key.userId !== userId) {
      return { success: false, error: 'NOT_AUTHORIZED' };
    }

    if (key.revokedAt !== null) {
      return { success: false, error: 'ALREADY_REVOKED' };
    }

    const revokedAt = new Date();
    await db.update(apiKeys).set({ revokedAt }).where(eq(apiKeys.id, keyId));

    return { success: true, revokedAt };
  } catch (error) {
    console.error('Key revocation failed:', error);
    return { success: false, error: 'KEY_NOT_FOUND' };
  }
}
