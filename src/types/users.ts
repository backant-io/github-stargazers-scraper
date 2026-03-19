export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SignupRequest {
  email: string;
}

export interface SignupResponse {
  user: {
    id: string;
    email: string;
    created_at: string;
  };
  api_key: {
    id: string;
    key: string;
    plan_type: string;
    created_at: string;
  };
  message: string;
}

export interface UserCreateResult {
  user: User;
  apiKey: {
    id: string;
    plaintext: string;
    planType: string;
    createdAt: Date;
  };
}
