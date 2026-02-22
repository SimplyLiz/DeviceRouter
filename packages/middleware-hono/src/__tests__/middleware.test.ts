import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createMiddleware } from '../middleware.js';
import type { DeviceRouterEnv } from '../middleware.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile } from '@device-router/types';

function createMockStorage(): StorageAdapter & { _store: Map<string, DeviceProfile> } {
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

describe('createMiddleware (hono)', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('sets deviceProfile to null when no cookie', async () => {
    const app = new Hono<DeviceRouterEnv>();
    app.use('*', createMiddleware({ storage }));
    app.get('/test', (c) => c.json({ profile: c.get('deviceProfile') }));

    const res = await app.request('/test');
    const data = (await res.json()) as { profile: unknown };
    expect(data.profile).toBeNull();
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

    const app = new Hono<DeviceRouterEnv>();
    app.use('*', createMiddleware({ storage }));
    app.get('/test', (c) => {
      const dp = c.get('deviceProfile');
      return c.json({ cpu: dp?.tiers.cpu, defer: dp?.hints.deferHeavyComponents });
    });

    const res = await app.request('/test', {
      headers: { Cookie: 'dr_session=tok1' },
    });
    const data = (await res.json()) as { cpu: string; defer: boolean };
    expect(data.cpu).toBe('high');
    expect(data.defer).toBe(false);
  });

  it('passes custom thresholds to classify', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 4 },
    };
    storage._store.set('tok2', profile);

    const app = new Hono<DeviceRouterEnv>();
    app.use('*', createMiddleware({ storage, thresholds: { cpu: { lowUpperBound: 6 } } }));
    app.get('/test', (c) => {
      const dp = c.get('deviceProfile');
      return c.json({ cpu: dp?.tiers.cpu });
    });

    const res = await app.request('/test', {
      headers: { Cookie: 'dr_session=tok2' },
    });
    const data = (await res.json()) as { cpu: string };
    expect(data.cpu).toBe('low');
  });
});
