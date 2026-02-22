import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMiddleware } from '../middleware.js';
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

function createMockCtx(cookieValues: Record<string, string> = {}) {
  return {
    cookies: {
      get: vi.fn((name: string) => cookieValues[name]),
      set: vi.fn(),
    },
    state: {} as Record<string, unknown>,
  } as unknown as import('koa').Context;
}

describe('createMiddleware (koa)', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('sets deviceProfile to null when no cookie', async () => {
    const mw = createMiddleware({ storage });
    const ctx = createMockCtx();
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.state.deviceProfile).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('sets deviceProfile to null when profile not found', async () => {
    const mw = createMiddleware({ storage });
    const ctx = createMockCtx({ dr_session: 'unknown' });
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.state.deviceProfile).toBeNull();
    expect(next).toHaveBeenCalled();
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

    const mw = createMiddleware({ storage });
    const ctx = createMockCtx({ dr_session: 'tok1' });
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.state.deviceProfile).not.toBeNull();
    expect(ctx.state.deviceProfile!.profile).toEqual(profile);
    expect(ctx.state.deviceProfile!.tiers.cpu).toBe('high');
    expect(ctx.state.deviceProfile!.tiers.memory).toBe('high');
    expect(ctx.state.deviceProfile!.hints.deferHeavyComponents).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it('uses custom cookie name', async () => {
    const mw = createMiddleware({ storage, cookieName: 'custom_session' });
    const ctx = createMockCtx({ custom_session: 'tok' });
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.cookies.get).toHaveBeenCalledWith('custom_session');
    expect(next).toHaveBeenCalled();
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

    const mw = createMiddleware({
      storage,
      thresholds: { cpu: { lowUpperBound: 6 } },
    });
    const ctx = createMockCtx({ dr_session: 'tok2' });
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.state.deviceProfile!.tiers.cpu).toBe('low');
  });
});
