import argon2 from 'argon2';

import { Password } from '../../domain/auth/password.js';
import type { PasswordHasher } from './types.js';

export function createArgon2PasswordHasher(): PasswordHasher {
  return {
    async hash(plaintext: string): Promise<Password> {
      const hash = await argon2.hash(plaintext, {
        type: argon2.argon2id,
      });

      return Password.fromHash(hash);
    },

    async verify(plaintext: string, password: Password): Promise<boolean> {
      try {
        return await argon2.verify(password.getHash(), plaintext);
      } catch {
        return false;
      }
    },
  };
}
