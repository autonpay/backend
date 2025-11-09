/**
 * JWT Utilities
 *
 * JWT token generation and verification.
 */

import * as jwt from 'jsonwebtoken';
import { config } from '../../shared/config';
import { JWTPayload } from './auth.types';

/**
 * Generate JWT token
 */
export function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = config.jwt.secret as jwt.Secret;
  const options: jwt.SignOptions = {
    expiresIn: config.jwt.expiry as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Verify JWT token
 */
export function verifyJWT(token: string): JWTPayload {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode JWT token without verification (for debugging)
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

