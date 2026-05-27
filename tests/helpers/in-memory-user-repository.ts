import type { User, UserId } from '../../src/domain/index.js';
import type { UserRepository } from '../../src/infrastructure/auth/types.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createInMemoryUserRepository(): UserRepository {
  const usersById = new Map<UserId, User>();
  const usersByEmail = new Map<string, User>();

  return {
    async findById(id: UserId): Promise<User | null> {
      return usersById.get(id) ?? null;
    },

    async findByEmail(email: string): Promise<User | null> {
      return usersByEmail.get(normalizeEmail(email)) ?? null;
    },

    async save(user: User): Promise<User> {
      usersById.set(user.id, user);
      usersByEmail.set(user.email, user);
      return user;
    },

    async existsByEmail(email: string): Promise<boolean> {
      return usersByEmail.has(normalizeEmail(email));
    },
  };
}
