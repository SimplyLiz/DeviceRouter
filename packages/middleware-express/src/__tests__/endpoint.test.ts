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

function createMockReq(body: unknown, cookies: Record<string, string> = {}) {
  return { body, cookies } as unknown as import('express').Request;
}

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  };
  return res as unknown as import('express').Response;
}

describe('createProbeEndpoint', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('stores profile and returns session token', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 4, deviceMemory: 8 });
    const res = createMockRes();

    await handler(req, res);

    expect(storage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaVersion: 1,
        signals: { hardwareConcurrency: 4, deviceMemory: 8 },
      }),
      86400,
    );
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      sessionToken: expect.any(String),
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'device-router-session',
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
    const req = createMockReq({ hardwareConcurrency: 4 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      'device-router-session',
      expect.any(String),
      expect.objectContaining({ secure: false }),
    );
  });

  it('enables secure cookie when cookieSecure is true', async () => {
    const handler = createProbeEndpoint({ storage, cookieSecure: true });
    const req = createMockReq({ hardwareConcurrency: 4 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      'device-router-session',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('reuses existing session token from cookie', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq(
      { hardwareConcurrency: 4 },
      { 'device-router-session': 'existing-tok' },
    );
    const res = createMockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      sessionToken: 'existing-tok',
    });
  });

  it('returns 400 for invalid payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 'not-a-number' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: 'Invalid probe payload',
    });
  });

  it('returns 400 for non-object payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq('not an object');
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uses custom options', async () => {
    const handler = createProbeEndpoint({
      storage,
      cookieName: 'my_session',
      cookiePath: '/app',
      ttl: 7200,
    });
    const req = createMockReq({ hardwareConcurrency: 4 });
    const res = createMockRes();

    await handler(req, res);

    expect(storage.set).toHaveBeenCalledWith(expect.any(String), expect.anything(), 7200);
    expect(res.cookie).toHaveBeenCalledWith(
      'my_session',
      expect.any(String),
      expect.objectContaining({ path: '/app', maxAge: 7200_000 }),
    );
  });

  it('handles storage errors gracefully', async () => {
    storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 4 });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: 'Internal server error',
    });
  });

  it('accepts empty signals object when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const req = createMockReq({});
    const res = createMockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      sessionToken: expect.any(String),
    });
  });

  it('rejects empty signals as bot by default', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({});
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Bot detected' });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('rejects bot user-agent', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      viewport: { width: 1024, height: 768 },
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('rejects headless GPU renderer', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
      viewport: { width: 1920, height: 1080 },
      gpuRenderer: 'Google SwiftShader',
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('allows bot signals when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const req = createMockReq({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      sessionToken: expect.any(String),
    });
    expect(storage.set).toHaveBeenCalled();
  });

  describe('onEvent', () => {
    it('emits profile:store after successful storage', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const signals = { hardwareConcurrency: 4, deviceMemory: 8 };
      const req = createMockReq(signals);
      const res = createMockRes();

      await handler(req, res);

      const storeEvents = events.filter((e) => e.type === 'profile:store');
      expect(storeEvents).toHaveLength(1);
      const event = storeEvents[0] as Extract<DeviceRouterEvent, { type: 'profile:store' }>;
      expect(typeof event.sessionToken).toBe('string');
      expect(event.signals).toEqual(signals);
      expect(typeof event.durationMs).toBe('number');
    });

    it('strips userAgent and viewport from profile:store signals', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({
        hardwareConcurrency: 4,
        userAgent: 'Mozilla/5.0 Test',
        viewport: { width: 1920, height: 1080 },
      });
      const res = createMockRes();

      await handler(req, res);

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
      const req = createMockReq({});
      const res = createMockRes();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      const botEvents = events.filter((e) => e.type === 'bot:reject');
      expect(botEvents).toHaveLength(1);
      const event = botEvents[0] as Extract<DeviceRouterEvent, { type: 'bot:reject' }>;
      expect(typeof event.sessionToken).toBe('string');
      expect(event.signals).toEqual({});
    });

    it('emits error event on storage failure', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({ hardwareConcurrency: 4 });
      const res = createMockRes();

      await handler(req, res);

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      const event = errorEvents[0] as Extract<DeviceRouterEvent, { type: 'error' }>;
      expect(event.phase).toBe('endpoint');
      expect(event.error).toBeInstanceOf(Error);
      expect((event.error as Error).message).toBe('Redis down');
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('callback errors do not break endpoint', async () => {
      const onEvent = vi.fn(() => {
        throw new Error('callback boom');
      });

      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({ hardwareConcurrency: 4, deviceMemory: 8 });
      const res = createMockRes();

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        sessionToken: expect.any(String),
      });
    });
  });
});
