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
    expect(setCookie).toContain('dr_session=');
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
