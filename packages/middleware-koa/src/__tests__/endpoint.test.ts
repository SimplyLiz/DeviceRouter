import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProbeEndpoint } from '../endpoint.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceRouterEvent } from '@device-router/types';

function createMockStorage(): StorageAdapter {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
  };
}

function createMockCtx(body: unknown, cookies: Record<string, string> = {}) {
  return {
    request: { body },
    cookies: {
      get: vi.fn((name: string) => cookies[name]),
      set: vi.fn(),
    },
    status: 200,
    body: undefined as unknown,
  } as unknown as import('koa').Context;
}

describe('createProbeEndpoint (koa)', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('stores profile and returns session token', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4, deviceMemory: 8 });

    await handler(ctx);

    expect(storage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaVersion: 1,
        signals: { hardwareConcurrency: 4, deviceMemory: 8 },
      }),
      86400,
    );
    expect((ctx.body as { ok: boolean }).ok).toBe(true);
    expect((ctx.body as { sessionToken: string }).sessionToken).toBeTruthy();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      }),
    );
  });

  it('does not set secure cookie by default', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4 });

    await handler(ctx);

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({ secure: false }),
    );
  });

  it('enables secure cookie when cookieSecure is true', async () => {
    const handler = createProbeEndpoint({ storage, cookieSecure: true });
    const ctx = createMockCtx({ hardwareConcurrency: 4 });

    await handler(ctx);

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('reuses existing session token from cookie', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4 }, { dr_session: 'existing-tok' });

    await handler(ctx);

    expect((ctx.body as { sessionToken: string }).sessionToken).toBe('existing-tok');
  });

  it('returns 400 for invalid payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 'not-a-number' });

    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect((ctx.body as { ok: boolean }).ok).toBe(false);
  });

  it('returns 400 for non-object payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx('not an object');

    await handler(ctx);

    expect(ctx.status).toBe(400);
  });

  it('handles storage errors gracefully', async () => {
    storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4 });

    await handler(ctx);

    expect(ctx.status).toBe(500);
    expect((ctx.body as { ok: boolean; error: string }).error).toBe('Internal server error');
  });

  it('accepts empty signals object when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const ctx = createMockCtx({});

    await handler(ctx);

    expect((ctx.body as { ok: boolean }).ok).toBe(true);
  });

  it('rejects empty signals as bot by default', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({});

    await handler(ctx);

    expect(ctx.status).toBe(403);
    expect((ctx.body as { error: string }).error).toBe('Bot detected');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('rejects bot user-agent', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      viewport: { width: 1024, height: 768 },
    });

    await handler(ctx);

    expect(ctx.status).toBe(403);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('allows bot signals when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const ctx = createMockCtx({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    });

    await handler(ctx);

    expect((ctx.body as { ok: boolean }).ok).toBe(true);
    expect(storage.set).toHaveBeenCalled();
  });

  describe('onEvent', () => {
    it('emits profile:store after successful storage', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const ctx = createMockCtx({ hardwareConcurrency: 4 });

      await handler(ctx);

      expect(onEvent).toHaveBeenCalled();
      const storeEvent = events.find((e) => e.type === 'profile:store');
      expect(storeEvent).toBeDefined();
      const event = storeEvent as Extract<DeviceRouterEvent, { type: 'profile:store' }>;
      expect(typeof event.sessionToken).toBe('string');
      expect(typeof event.durationMs).toBe('number');
    });

    it('strips userAgent and viewport from profile:store signals', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const ctx = createMockCtx({
        hardwareConcurrency: 4,
        userAgent: 'Mozilla/5.0 Test',
        viewport: { width: 1920, height: 1080 },
      });

      await handler(ctx);

      const event = events.find((e) => e.type === 'profile:store') as Extract<
        DeviceRouterEvent,
        { type: 'profile:store' }
      >;
      expect(event.signals).toEqual({ hardwareConcurrency: 4 });
      expect(event.signals).not.toHaveProperty('userAgent');
      expect(event.signals).not.toHaveProperty('viewport');
    });

    it('emits bot:reject when bot detected', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const ctx = createMockCtx({});

      await handler(ctx);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('bot:reject');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'bot:reject' }>;
      expect(event.signals).toEqual({});
    });

    it('emits error event on storage failure', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
      const handler = createProbeEndpoint({ storage, onEvent });
      const ctx = createMockCtx({ hardwareConcurrency: 4 });

      await handler(ctx);

      expect(ctx.status).toBe(500);
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      const event = errorEvent as Extract<DeviceRouterEvent, { type: 'error' }>;
      expect(event.phase).toBe('endpoint');
      expect(event.error).toBeInstanceOf(Error);
      expect((event.error as Error).message).toBe('Redis down');
    });

    it('callback errors do not break endpoint', async () => {
      const onEvent = vi.fn(() => {
        throw new Error('callback boom');
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const ctx = createMockCtx({ hardwareConcurrency: 4 });

      await handler(ctx);

      expect((ctx.body as { ok: boolean }).ok).toBe(true);
    });
  });
});
