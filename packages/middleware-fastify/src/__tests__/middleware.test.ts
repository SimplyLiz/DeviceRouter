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
  } as unknown as import('fastify').FastifyRequest;
}

describe('createMiddleware', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('sets deviceProfile to null when no cookie', async () => {
    const hook = createMiddleware({ storage });
    const req = createMockReq();

    await hook(req);

    expect(req.deviceProfile).toBeNull();
  });

  it('sets deviceProfile to null when profile not found', async () => {
    const hook = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'unknown' });

    await hook(req);

    expect(req.deviceProfile).toBeNull();
  });

  it('attaches classified profile when found', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 8, deviceMemory: 8 },
    };
    storage._store.set('tok1', profile);

    const hook = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'tok1' });

    await hook(req);

    expect(req.deviceProfile).not.toBeNull();
    expect(req.deviceProfile!.profile).toEqual(profile);
    expect(req.deviceProfile!.tiers.cpu).toBe('high');
    expect(req.deviceProfile!.tiers.memory).toBe('high');
    expect(req.deviceProfile!.hints.deferHeavyComponents).toBe(false);
  });

  it('uses custom cookie name', async () => {
    const hook = createMiddleware({ storage, cookieName: 'custom_session' });
    const req = createMockReq({ custom_session: 'tok' });

    await hook(req);

    expect(storage.get).toHaveBeenCalledWith('tok');
  });

  it('passes custom thresholds to classify', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 4, deviceMemory: 4 },
    };
    storage._store.set('tok2', profile);

    const hook = createMiddleware({
      storage,
      thresholds: { cpu: { lowUpperBound: 6 } },
    });
    const req = createMockReq({ dr_session: 'tok2' });

    await hook(req);

    expect(req.deviceProfile!.tiers.cpu).toBe('low');
  });
});
