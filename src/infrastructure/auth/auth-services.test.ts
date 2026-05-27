import { describe, expect, it } from 'vitest';

import { createArgon2PasswordHasher } from './password-hasher.js';

describe('createArgon2PasswordHasher', () => {
  it('hashes and verifies passwords', async () => {
    const hasher = createArgon2PasswordHasher();

    const password = await hasher.hash('Password1');
    await expect(hasher.verify('Password1', password)).resolves.toBe(true);
    await expect(hasher.verify('WrongPassword1', password)).resolves.toBe(false);
  });

  it('produces distinct hashes for the same plaintext', async () => {
    const hasher = createArgon2PasswordHasher();

    const first = await hasher.hash('Password1');
    const second = await hasher.hash('Password1');

    expect(first).not.toBe(second);
    await expect(hasher.verify('Password1', first)).resolves.toBe(true);
    await expect(hasher.verify('Password1', second)).resolves.toBe(true);
  });
});
