import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryStorageAdapter } from '../memory.js';
import type { DeviceProfile } from '@device-router/types';

const makeProfile = (token: string): DeviceProfile => ({
  schemaVersion: 1,
  sessionToken: token,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  signals: { hardwareConcurrency: 4 },
});

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(() => {
    adapter = new MemoryStorageAdapter();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await adapter.clear();
    vi.useRealTimers();
  });

  it('stores and retrieves a profile', async () => {
    const profile = makeProfile('tok1');
    await adapter.set('tok1', profile, 3600);
    const result = await adapter.get('tok1');
    expect(result).toEqual(profile);
  });

  it('returns null for non-existent key', async () => {
    expect(await adapter.get('missing')).toBeNull();
  });

  it('deletes a profile', async () => {
    const profile = makeProfile('tok2');
    await adapter.set('tok2', profile, 3600);
    await adapter.delete('tok2');
    expect(await adapter.get('tok2')).toBeNull();
  });

  it('checks existence', async () => {
    const profile = makeProfile('tok3');
    expect(await adapter.exists('tok3')).toBe(false);
    await adapter.set('tok3', profile, 3600);
    expect(await adapter.exists('tok3')).toBe(true);
  });

  it('expires entries after TTL', async () => {
    const profile = makeProfile('tok4');
    await adapter.set('tok4', profile, 1);

    expect(await adapter.get('tok4')).toEqual(profile);

    vi.advanceTimersByTime(1500);
    expect(await adapter.get('tok4')).toBeNull();
  });

  it('overwrites existing entry', async () => {
    const p1 = makeProfile('tok5');
    const p2 = { ...makeProfile('tok5'), signals: { hardwareConcurrency: 8 } };
    await adapter.set('tok5', p1, 3600);
    await adapter.set('tok5', p2, 3600);
    const result = await adapter.get('tok5');
    expect(result?.signals.hardwareConcurrency).toBe(8);
  });

  it('clears all entries', async () => {
    await adapter.set('a', makeProfile('a'), 3600);
    await adapter.set('b', makeProfile('b'), 3600);
    await adapter.clear();
    expect(await adapter.get('a')).toBeNull();
    expect(await adapter.get('b')).toBeNull();
  });

  describe('count', () => {
    it('returns zero when empty', async () => {
      expect(await adapter.count()).toBe(0);
    });

    it('returns the number of stored entries', async () => {
      await adapter.set('a', makeProfile('a'), 3600);
      await adapter.set('b', makeProfile('b'), 3600);
      expect(await adapter.count()).toBe(2);
    });

    it('excludes expired entries', async () => {
      await adapter.set('a', makeProfile('a'), 1);
      await adapter.set('b', makeProfile('b'), 3600);
      vi.advanceTimersByTime(1500);
      expect(await adapter.count()).toBe(1);
    });
  });

  describe('keys', () => {
    it('returns empty array when empty', async () => {
      expect(await adapter.keys()).toEqual([]);
    });

    it('returns session token keys', async () => {
      await adapter.set('tok1', makeProfile('tok1'), 3600);
      await adapter.set('tok2', makeProfile('tok2'), 3600);
      const keys = await adapter.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('tok1');
      expect(keys).toContain('tok2');
    });

    it('excludes expired entries', async () => {
      await adapter.set('a', makeProfile('a'), 1);
      await adapter.set('b', makeProfile('b'), 3600);
      vi.advanceTimersByTime(1500);
      expect(await adapter.keys()).toEqual(['b']);
    });
  });

  describe('has', () => {
    it('returns false for non-existent key', async () => {
      expect(await adapter.has('missing')).toBe(false);
    });

    it('returns true for existing key', async () => {
      await adapter.set('tok1', makeProfile('tok1'), 3600);
      expect(await adapter.has('tok1')).toBe(true);
    });

    it('returns false after TTL expiry', async () => {
      await adapter.set('tok1', makeProfile('tok1'), 1);
      vi.advanceTimersByTime(1500);
      expect(await adapter.has('tok1')).toBe(false);
    });
  });
});
