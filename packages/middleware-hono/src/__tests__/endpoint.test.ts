import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createProbeEndpoint } from '../endpoint.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceRouterEvent } from '@device-router/types';

function createMockStorage(): StorageAdapter {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    clear: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    keys: vi.fn().mockResolvedValue([]),
  };
}

describe('createProbeEndpoint (hono)', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('stores profile and returns session token', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hardwareConcurrency: 4, deviceMemory: 8 }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; sessionToken: string };
    expect(data.ok).toBe(true);
    expect(data.sessionToken).toBeTruthy();

    expect(storage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaVersion: 1,
        signals: { hardwareConcurrency: 4, deviceMemory: 8 },
      }),
      86400,
    );

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('device-router-session=');
    expect(setCookie).not.toContain('Secure');
  });

  it('does not set secure cookie by default', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hardwareConcurrency: 4 }),
    });

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).not.toContain('Secure');
  });

  it('enables secure cookie when cookieSecure is true', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage, cookieSecure: true }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hardwareConcurrency: 4 }),
    });

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('Secure');
  });

  it('returns 400 for invalid payload', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hardwareConcurrency: 'not-a-number' }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
  });

  it('returns 400 for malformed JSON', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Invalid probe payload');
  });

  it('accepts empty signals object when rejectBots is false', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage, rejectBots: false }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it('rejects empty signals as bot by default', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.error).toBe('Bot detected');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('rejects bot user-agent', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hardwareConcurrency: 4,
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        viewport: { width: 1024, height: 768 },
      }),
    });

    expect(res.status).toBe(403);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('allows bot signals when rejectBots is false', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage, rejectBots: false }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(storage.set).toHaveBeenCalled();
  });

  describe('onEvent', () => {
    it('emits profile:store after successful storage', async () => {
      const onEvent = vi.fn();
      const app = new Hono();
      app.post('/probe', createProbeEndpoint({ storage, onEvent }));

      const res = await app.request('/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardwareConcurrency: 4, deviceMemory: 8 }),
      });

      expect(res.status).toBe(200);
      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('profile:store');
      expect(typeof (event as { sessionToken: string }).sessionToken).toBe('string');
      expect(typeof (event as { durationMs: number }).durationMs).toBe('number');
    });

    it('strips userAgent and viewport from profile:store signals', async () => {
      const onEvent = vi.fn();
      const app = new Hono();
      app.post('/probe', createProbeEndpoint({ storage, onEvent }));

      const res = await app.request('/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardwareConcurrency: 4,
          userAgent: 'Mozilla/5.0 Test',
          viewport: { width: 1920, height: 1080 },
        }),
      });

      expect(res.status).toBe(200);
      const event = onEvent.mock.calls[0][0] as Extract<
        DeviceRouterEvent,
        { type: 'profile:store' }
      >;
      expect(event.signals).toEqual({ hardwareConcurrency: 4 });
      expect(event.signals).not.toHaveProperty('userAgent');
      expect(event.signals).not.toHaveProperty('viewport');
    });

    it('emits bot:reject when bot detected', async () => {
      const onEvent = vi.fn();
      const app = new Hono();
      app.post('/probe', createProbeEndpoint({ storage, onEvent }));

      const res = await app.request('/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('bot:reject');
      const botEvent = event as Extract<DeviceRouterEvent, { type: 'bot:reject' }>;
      expect(botEvent.signals).toEqual({});
      expect(typeof botEvent.durationMs).toBe('number');
    });

    it('emits error event on storage failure', async () => {
      const onEvent = vi.fn();
      storage.set = vi.fn().mockRejectedValue(new Error('storage down'));

      const app = new Hono();
      app.post('/probe', createProbeEndpoint({ storage, onEvent }));

      const res = await app.request('/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardwareConcurrency: 4, deviceMemory: 8 }),
      });

      expect(res.status).toBe(500);
      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('error');
      expect(event).toHaveProperty('phase', 'endpoint');
      const errorEvent = event as Extract<DeviceRouterEvent, { type: 'error' }>;
      expect(errorEvent.error).toBeInstanceOf(Error);
      expect((errorEvent.error as Error).message).toBe('storage down');
      expect(errorEvent.errorMessage).toBe('storage down');
    });

    it('callback errors do not break endpoint', async () => {
      const onEvent = vi.fn().mockImplementation(() => {
        throw new Error('callback boom');
      });
      const app = new Hono();
      app.post('/probe', createProbeEndpoint({ storage, onEvent }));

      const res = await app.request('/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardwareConcurrency: 4, deviceMemory: 8 }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
    });
  });
});
