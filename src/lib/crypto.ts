import { createHash, randomBytes } from 'crypto';

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/** Oturum token'ları veritabanında yalnızca SHA-256 özeti olarak saklanır. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
