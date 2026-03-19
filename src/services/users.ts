import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { createApiKey } from './apiKeys';
import type { Database } from '../db';
import type { UserCreateResult } from '../types/users';
import { ValidationError, DuplicateError } from '../types/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export async function createUser(db: Database, email: string): Promise<UserCreateResult> {
  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  const normalizedEmail = email.toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new DuplicateError('Email already registered');
  }

  const userResult = await db.insert(users).values({ email: normalizedEmail }).returning({
    id: users.id,
    email: users.email,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  });

  const user = userResult[0];

  const apiKey = await createApiKey(db, user.id, 'free');

  return {
    user,
    apiKey: {
      id: apiKey.id,
      plaintext: apiKey.plaintext,
      planType: apiKey.planType,
      createdAt: apiKey.createdAt,
    },
  };
}
