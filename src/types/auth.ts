export type PlanType = 'free' | 'pro' | 'enterprise';

export interface AuthContext {
  userId: string;
  keyId: string;
  planType: PlanType;
}

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  key_hash: string;
  plan_type: PlanType;
  created_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: 'missing_header' | 'malformed_header' | 'invalid_key' };
