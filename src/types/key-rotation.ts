export interface KeyRotationResult {
  success: true;
  apiKey: string;
  keyId: string;
  expiresOldKeyAt: Date;
}

export interface KeyRotationError {
  success: false;
  error: 'NO_EXISTING_KEY' | 'DATABASE_ERROR';
}

export interface KeyRevocationResult {
  success: true;
  revokedAt: Date;
}

export interface KeyRevocationError {
  success: false;
  error: 'KEY_NOT_FOUND' | 'NOT_AUTHORIZED' | 'ALREADY_REVOKED';
}
