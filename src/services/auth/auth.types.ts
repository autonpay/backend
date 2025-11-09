/**
 * Auth Service Types
 *
 * Authentication and authorization types.
 */

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
  };
  token: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  organizationId: string;
  role?: string;
}

export interface RegisterResult {
  user: {
    id: string;
    email: string;
    organizationId: string;
    role: string;
  };
  token: string;
}

export interface JWTPayload {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

export type ApiKeyEnvironment = 'live' | 'test';

export interface APIKeyResult {
  key: string;      // Shown to user once (e.g., "sk_live_abc123...")
  keyHash: string;  // Stored in database
  id: string;       // API key ID
  environment: ApiKeyEnvironment;
}

export interface ValidatedAPIKey {
  id: string;
  organizationId: string;
  name?: string;
  environment: ApiKeyEnvironment;
}

