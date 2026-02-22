import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMiddleware } from '../middleware.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile } from '@device-router/types';

function createMockStorage(): StorageAdapter {
  const store = new Map<string, DeviceProfile>();
  return {
    get: vi.fn(async (token: string) => store.get(token) ?? null),
    set: vi.fn(async (token: string, profile: DeviceProfile) => {
      store.set(token, profile);
    }),
    delete: vi.fn(async (token: string) => {
      store.delete(token);
    }),
    exists: vi.fn(async (token: string) => store.has(token)),
    _store: store,
  } as StorageAdapter & { _store: Map<string, DeviceProfile> };
}

function createMockReq(cookies: Record<string, string> = {}) {
  return {
    cookies,
    deviceProfile: undefined,
  } as unknown as import('express').Request;
}

function createMockRes() {
  return {} as unknown as import('express').Response;
}

describe('createMiddleware', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('sets deviceProfile to null when no cookie', async () => {
    const mw = createMiddleware({ storage });
    const req = createMockReq();
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(req.deviceProfile).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('sets deviceProfile to null when profile not found', async () => {
    const mw = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'unknown' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(req.deviceProfile).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('attaches classified profile when found', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 8, deviceMemory: 8 },
    };
    (storage as unknown as { _store: Map<string, DeviceProfile> })._store.set('tok1', profile);

    const mw = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'tok1' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(req.deviceProfile).not.toBeNull();
    expect(req.deviceProfile!.profile).toEqual(profile);
    expect(req.deviceProfile!.tiers.cpu).toBe('high');
    expect(req.deviceProfile!.tiers.memory).toBe('high');
    expect(req.deviceProfile!.hints.deferHeavyComponents).toBe(false);
    expect(next).toHaveBeenCalledWith();
  });

  it('uses custom cookie name', async () => {
    const mw = createMiddleware({ storage, cookieName: 'custom_session' });
    const req = createMockReq({ custom_session: 'tok' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(storage.get).toHaveBeenCalledWith('tok');
    expect(next).toHaveBeenCalled();
  });

  it('calls next with error on storage failure', async () => {
    storage.get = vi.fn().mockRejectedValue(new Error('Storage down'));
    const mw = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'tok' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('passes custom thresholds to classify', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 4, deviceMemory: 4 },
    };
    (storage as unknown as { _store: Map<string, DeviceProfile> })._store.set('tok2', profile);

    // Default thresholds: 4 cores = mid, 4 GB = mid
    const mwDefault = createMiddleware({ storage });
    const req1 = createMockReq({ dr_session: 'tok2' });
    await mwDefault(req1, createMockRes(), vi.fn());
    expect(req1.deviceProfile!.tiers.cpu).toBe('mid');
    expect(req1.deviceProfile!.tiers.memory).toBe('mid');

    // Custom thresholds: raise lowUpperBound to 6 → 4 cores = low
    const mwCustom = createMiddleware({
      storage,
      thresholds: { cpu: { lowUpperBound: 6 }, memory: { lowUpperBound: 6 } },
    });
    const req2 = createMockReq({ dr_session: 'tok2' });
    await mwCustom(req2, createMockRes(), vi.fn());
    expect(req2.deviceProfile!.tiers.cpu).toBe('low');
    expect(req2.deviceProfile!.tiers.memory).toBe('low');
  });
});
