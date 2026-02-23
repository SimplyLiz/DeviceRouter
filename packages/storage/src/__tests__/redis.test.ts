import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisStorageAdapter } from '../redis.js';
import type { DeviceProfile } from '@device-router/types';

const makeProfile = (token: string): DeviceProfile => ({
  schemaVersion: 1,
  sessionToken: token,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  signals: { hardwareConcurrency: 4 },
});

function createMockClient() {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() >= entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, ...args: string[]) => {
      const entry: { value: string; expiresAt?: number } = { value };
      if (args[0] === 'EX') {
        entry.expiresAt = Date.now() + parseInt(args[1], 10) * 1000;
      }
      store.set(key, entry);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      return store.delete(key) ? 1 : 0;
    }),
    exists: vi.fn(async (key: string) => {
      return store.has(key) ? 1 : 0;
    }),
    _store: store,
  };
}

describe('RedisStorageAdapter', () => {
  let client: ReturnType<typeof createMockClient>;
  let adapter: RedisStorageAdapter;

  beforeEach(() => {
    client = createMockClient();
    adapter = new RedisStorageAdapter({ client });
  });

  it('stores and retrieves a profile', async () => {
    const profile = makeProfile('tok1');
    await adapter.set('tok1', profile, 3600);
    const result = await adapter.get('tok1');
    expect(result).toEqual(profile);
  });

  it('uses SET with EX for TTL', async () => {
    const profile = makeProfile('tok2');
    await adapter.set('tok2', profile, 7200);
    expect(client.set).toHaveBeenCalledWith(
      'dr:profile:tok2',
      JSON.stringify(profile),
      'EX',
      '7200',
    );
  });

  it('returns null for non-existent key', async () => {
    expect(await adapter.get('missing')).toBeNull();
  });

  it('deletes a profile', async () => {
    const profile = makeProfile('tok3');
    await adapter.set('tok3', profile, 3600);
    await adapter.delete('tok3');
    expect(await adapter.get('tok3')).toBeNull();
  });

  it('checks existence', async () => {
    expect(await adapter.exists('tok4')).toBe(false);
    await adapter.set('tok4', makeProfile('tok4'), 3600);
    expect(await adapter.exists('tok4')).toBe(true);
  });

  it('uses custom key prefix', async () => {
    const custom = new RedisStorageAdapter({ client, keyPrefix: 'custom:' });
    const profile = makeProfile('tok5');
    await custom.set('tok5', profile, 3600);
    expect(client.set).toHaveBeenCalledWith('custom:tok5', expect.any(String), 'EX', '3600');
  });

  describe('error handling', () => {
    it('get returns null on connection error', async () => {
      client.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await adapter.get('tok1')).toBeNull();
    });

    it('get returns null on corrupted JSON', async () => {
      client.get.mockResolvedValueOnce('not-valid-json{{{');
      expect(await adapter.get('tok1')).toBeNull();
    });

    it('set does not throw on connection error', async () => {
      client.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(adapter.set('tok1', makeProfile('tok1'), 3600)).resolves.toBeUndefined();
    });

    it('delete does not throw on connection error', async () => {
      client.del.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(adapter.delete('tok1')).resolves.toBeUndefined();
    });

    it('exists returns false on connection error', async () => {
      client.exists.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await adapter.exists('tok1')).toBe(false);
    });
  });
});
