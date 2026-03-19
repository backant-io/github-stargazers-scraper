import type { PlanType } from './auth';

export interface ApiKeyCreateResult {
  id: string;
  plaintext: string;
  planType: PlanType;
  createdAt: Date;
}

export interface CreateKeyResponse {
  api_key: {
    id: string;
    key: string;
    plan_type: string;
    created_at: string;
  };
  message: string;
}
