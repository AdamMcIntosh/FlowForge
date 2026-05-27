import type { PrismaClient } from '@prisma/client';

import { Password } from '../../domain/auth/password.js';
import { User } from '../../domain/auth/user.js';
import type { UserRepository } from './types.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email: string): Promise<User | null> {
      const record = await prisma.user.findUnique({
        where: { email: normalizeEmail(email) },
      });

      if (record === null) {
        return null;
      }

      return User.reconstitute({
        id: record.id,
        email: record.email,
        name: record.name,
        password: Password.fromHash(record.password),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    },

    async findById(id: string): Promise<User | null> {
      const record = await prisma.user.findUnique({
        where: { id },
      });

      if (record === null) {
        return null;
      }

      return User.reconstitute({
        id: record.id,
        email: record.email,
        name: record.name,
        password: Password.fromHash(record.password),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    },

    async save(user: User): Promise<User> {
      const props = user.toProps();
      const record = await prisma.user.create({
        data: {
          id: props.id,
          email: props.email,
          name: props.name,
          password: props.password.getHash(),
          createdAt: props.createdAt,
          updatedAt: props.updatedAt,
        },
      });

      return User.reconstitute({
        id: record.id,
        email: record.email,
        name: record.name,
        password: Password.fromHash(record.password),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    },

    async existsByEmail(email: string): Promise<boolean> {
      const count = await prisma.user.count({
        where: { email: normalizeEmail(email) },
      });

      return count > 0;
    },
  };
}
