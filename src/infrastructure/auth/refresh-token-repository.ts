import type { RefreshTokenRecord, RefreshTokenRepository, RefreshTokenStatus } from './types.js';

export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  const records = new Map<string, RefreshTokenRecord>();
  const revokedFamilies = new Set<string>();

  return {
    async save(record: RefreshTokenRecord): Promise<void> {
      records.set(record.jti, { ...record });
    },

    async findByJti(jti: string): Promise<RefreshTokenRecord | null> {
      const record = records.get(jti);
      return record === undefined ? null : { ...record };
    },

    async updateStatus(jti: string, status: RefreshTokenStatus): Promise<void> {
      const record = records.get(jti);
      if (record === undefined) {
        return;
      }

      records.set(jti, { ...record, status });
    },

    async revokeFamily(family: string): Promise<void> {
      revokedFamilies.add(family);

      for (const [jti, record] of records.entries()) {
        if (record.family === family) {
          records.set(jti, { ...record, status: 'revoked' });
        }
      }
    },

    isFamilyRevoked(family: string): boolean {
      return revokedFamilies.has(family);
    },
  };
}
