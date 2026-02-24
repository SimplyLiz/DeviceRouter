import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMiddleware } from '../middleware.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, DeviceRouterEvent } from '@device-router/types';

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

function createMockCtx(
  cookieValues: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const responseHeaders: Record<string, string> = {};
  return {
    cookies: {
      get: vi.fn((name: string) => cookieValues[name]),
      set: vi.fn(),
    },
    request: {
      headers,
    },
    state: {} as Record<string, unknown>,
    set: vi.fn((name: string, value: string) => {
      responseHeaders[name] = value;
    }),
    _responseHeaders: responseHeaders,
  } as unknown as import('koa').Context & { _responseHeaders: Record<string, string> };
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
    expect(ctx.state.deviceProfile!.source).toBe('probe');
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
      thresholds: { cpu: { lowUpperBound: 6, midUpperBound: 8 } },
    });
    const ctx = createMockCtx({ dr_session: 'tok2' });
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.state.deviceProfile!.tiers.cpu).toBe('low');
  });

  describe('fallbackProfile', () => {
    it('returns conservative fallback when configured', async () => {
      const mw = createMiddleware({ storage, fallbackProfile: 'conservative' });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.source).toBe('fallback');
      expect(ctx.state.deviceProfile!.tiers.cpu).toBe('low');
      expect(ctx.state.deviceProfile!.tiers.connection).toBe('3g');
    });

    it('returns optimistic fallback when configured', async () => {
      const mw = createMiddleware({ storage, fallbackProfile: 'optimistic' });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.source).toBe('fallback');
      expect(ctx.state.deviceProfile!.tiers.cpu).toBe('high');
      expect(ctx.state.deviceProfile!.tiers.connection).toBe('fast');
    });

    it('returns custom DeviceTiers fallback', async () => {
      const mw = createMiddleware({
        storage,
        fallbackProfile: { cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'low' },
      });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.source).toBe('fallback');
      expect(ctx.state.deviceProfile!.tiers).toEqual({
        cpu: 'mid',
        memory: 'mid',
        connection: '4g',
        gpu: 'low',
      });
    });

    it('falls back when cookie exists but profile not in storage', async () => {
      const mw = createMiddleware({ storage, fallbackProfile: 'conservative' });
      const ctx = createMockCtx({ dr_session: 'expired-token' });
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.source).toBe('fallback');
    });
  });

  describe('classifyFromHeaders', () => {
    it('classifies mobile UA from headers', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const ctx = createMockCtx(
        {},
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
      );
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.source).toBe('headers');
      expect(ctx.state.deviceProfile!.tiers.cpu).toBe('low');
    });

    it('uses Client Hints when present', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const ctx = createMockCtx(
        {},
        {
          'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
          'device-memory': '2',
          'save-data': 'on',
        },
      );
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.tiers.memory).toBe('low');
      expect(ctx.state.deviceProfile!.tiers.connection).toBe('3g');
    });

    it('takes priority over fallbackProfile', async () => {
      const mw = createMiddleware({
        storage,
        classifyFromHeaders: true,
        fallbackProfile: 'conservative',
      });
      const ctx = createMockCtx(
        {},
        { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0' },
      );
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile!.source).toBe('headers');
      expect(ctx.state.deviceProfile!.tiers.cpu).toBe('high');
    });

    it('sets Accept-CH header when enabled', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx._responseHeaders['Accept-CH']).toContain('Device-Memory');
    });

    it('does not set Accept-CH header by default', async () => {
      const mw = createMiddleware({ storage });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx._responseHeaders['Accept-CH']).toBeUndefined();
    });
  });

  describe('onEvent', () => {
    it('emits profile:classify with source probe when profile found in storage', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken: 'tok1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        signals: { hardwareConcurrency: 8, deviceMemory: 8 },
      };
      storage._store.set('tok1', profile);

      const mw = createMiddleware({ storage, onEvent });
      const ctx = createMockCtx({ dr_session: 'tok1' });
      const next = vi.fn();

      await mw(ctx, next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('profile:classify');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'profile:classify' }>;
      expect(event.source).toBe('probe');
      expect(event.sessionToken).toBe('tok1');
      expect(typeof event.durationMs).toBe('number');
    });

    it('emits profile:classify with source headers when classifyFromHeaders enabled', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const mw = createMiddleware({ storage, classifyFromHeaders: true, onEvent });
      const ctx = createMockCtx(
        {},
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
      );
      const next = vi.fn();

      await mw(ctx, next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('profile:classify');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'profile:classify' }>;
      expect(event.source).toBe('headers');
    });

    it('emits profile:classify with source fallback when fallbackProfile set', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const mw = createMiddleware({ storage, fallbackProfile: 'conservative', onEvent });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('profile:classify');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'profile:classify' }>;
      expect(event.source).toBe('fallback');
    });

    it('does not emit when no profile resolved', async () => {
      const onEvent = vi.fn();

      const mw = createMiddleware({ storage, onEvent });
      const ctx = createMockCtx();
      const next = vi.fn();

      await mw(ctx, next);

      expect(onEvent).not.toHaveBeenCalled();
    });

    it('emits error event on storage failure', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      storage.get = vi.fn().mockRejectedValue(new Error('Storage down'));
      const mw = createMiddleware({ storage, onEvent });
      const ctx = createMockCtx({ dr_session: 'tok-err' });
      const next = vi.fn();

      await expect(mw(ctx, next)).rejects.toThrow('Storage down');

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('error');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'error' }>;
      expect(event.phase).toBe('middleware');
      expect(event.error).toBeInstanceOf(Error);
      expect((event.error as Error).message).toBe('Storage down');
    });

    it('callback errors do not break middleware', async () => {
      const onEvent = vi.fn(() => {
        throw new Error('callback boom');
      });

      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken: 'tok-safe',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        signals: { hardwareConcurrency: 8, deviceMemory: 8 },
      };
      storage._store.set('tok-safe', profile);

      const mw = createMiddleware({ storage, onEvent });
      const ctx = createMockCtx({ dr_session: 'tok-safe' });
      const next = vi.fn();

      await mw(ctx, next);

      expect(ctx.state.deviceProfile).not.toBeNull();
      expect(ctx.state.deviceProfile!.source).toBe('probe');
      expect(next).toHaveBeenCalled();
    });
  });
});
