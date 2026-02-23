import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createMiddleware } from '../middleware.js';
import type { DeviceRouterEnv } from '../middleware.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, ClassifiedProfile, DeviceRouterEvent } from '@device-router/types';

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
      return c.json({
        cpu: dp?.tiers.cpu,
        defer: dp?.hints.deferHeavyComponents,
        source: dp?.source,
      });
    });

    const res = await app.request('/test', {
      headers: { Cookie: 'dr_session=tok1' },
    });
    const data = (await res.json()) as { cpu: string; defer: boolean; source: string };
    expect(data.cpu).toBe('high');
    expect(data.defer).toBe(false);
    expect(data.source).toBe('probe');
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

  describe('fallbackProfile', () => {
    it('returns conservative fallback when configured', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, fallbackProfile: 'conservative' }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test');
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.source).toBe('fallback');
      expect(data.tiers.cpu).toBe('low');
      expect(data.tiers.connection).toBe('3g');
    });

    it('returns optimistic fallback when configured', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, fallbackProfile: 'optimistic' }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test');
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.source).toBe('fallback');
      expect(data.tiers.cpu).toBe('high');
      expect(data.tiers.connection).toBe('fast');
    });

    it('returns custom DeviceTiers fallback', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use(
        '*',
        createMiddleware({
          storage,
          fallbackProfile: { cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'low' },
        }),
      );
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test');
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.source).toBe('fallback');
      expect(data.tiers).toEqual({ cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'low' });
    });

    it('falls back when cookie exists but profile not in storage', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, fallbackProfile: 'conservative' }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test', {
        headers: { Cookie: 'dr_session=expired' },
      });
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.source).toBe('fallback');
    });
  });

  describe('classifyFromHeaders', () => {
    it('classifies mobile UA from headers', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, classifyFromHeaders: true }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile',
        },
      });
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.source).toBe('headers');
      expect(data.tiers.cpu).toBe('low');
    });

    it('uses Client Hints when present', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, classifyFromHeaders: true }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test', {
        headers: {
          'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
          'Device-Memory': '2',
          'Save-Data': 'on',
        },
      });
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.tiers.memory).toBe('low');
      expect(data.tiers.connection).toBe('3g');
    });

    it('takes priority over fallbackProfile', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use(
        '*',
        createMiddleware({
          storage,
          classifyFromHeaders: true,
          fallbackProfile: 'conservative',
        }),
      );
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0',
        },
      });
      const data = (await res.json()) as ClassifiedProfile;
      expect(data.source).toBe('headers');
      expect(data.tiers.cpu).toBe('high');
    });

    it('sets Accept-CH header when enabled', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, classifyFromHeaders: true }));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test');
      expect(res.headers.get('Accept-CH')).toContain('Device-Memory');
    });

    it('does not set Accept-CH header by default', async () => {
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage }));
      app.get('/test', (c) => c.text('ok'));

      const res = await app.request('/test');
      expect(res.headers.get('Accept-CH')).toBeNull();
    });
  });

  describe('onEvent', () => {
    it('emits profile:classify with source probe when profile found in storage', async () => {
      const onEvent = vi.fn();
      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken: 'tok1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        signals: { hardwareConcurrency: 8, deviceMemory: 8 },
      };
      storage._store.set('tok1', profile);

      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, onEvent }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      await app.request('/test', {
        headers: { Cookie: 'dr_session=tok1' },
      });

      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('profile:classify');
      expect(event).toHaveProperty('source', 'probe');
      expect(event).toHaveProperty('durationMs');
      expect(typeof (event as { durationMs: number }).durationMs).toBe('number');
    });

    it('emits profile:classify with source headers when classifyFromHeaders enabled', async () => {
      const onEvent = vi.fn();
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, classifyFromHeaders: true, onEvent }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      await app.request('/test', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile',
        },
      });

      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('profile:classify');
      expect(event).toHaveProperty('source', 'headers');
    });

    it('emits profile:classify with source fallback when fallbackProfile set', async () => {
      const onEvent = vi.fn();
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, fallbackProfile: 'conservative', onEvent }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      await app.request('/test');

      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('profile:classify');
      expect(event).toHaveProperty('source', 'fallback');
    });

    it('does not emit when no profile resolved', async () => {
      const onEvent = vi.fn();
      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, onEvent }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      await app.request('/test');

      expect(onEvent).not.toHaveBeenCalled();
    });

    it('emits error event on storage failure', async () => {
      const onEvent = vi.fn();
      storage.get = vi.fn().mockRejectedValue(new Error('storage down'));

      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, onEvent }));
      app.get('/test', (c) => c.json(c.get('deviceProfile')));

      const res = await app.request('/test', {
        headers: { Cookie: 'dr_session=tok1' },
      });

      expect(res.status).toBe(500);
      expect(onEvent).toHaveBeenCalledOnce();
      const event = onEvent.mock.calls[0][0] as DeviceRouterEvent;
      expect(event.type).toBe('error');
      expect(event).toHaveProperty('phase', 'middleware');
      const errorEvent = event as Extract<DeviceRouterEvent, { type: 'error' }>;
      expect(errorEvent.error).toBeInstanceOf(Error);
      expect((errorEvent.error as Error).message).toBe('storage down');
    });

    it('callback errors do not break middleware', async () => {
      const onEvent = vi.fn().mockImplementation(() => {
        throw new Error('callback boom');
      });
      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken: 'tok1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        signals: { hardwareConcurrency: 8, deviceMemory: 8 },
      };
      storage._store.set('tok1', profile);

      const app = new Hono<DeviceRouterEnv>();
      app.use('*', createMiddleware({ storage, onEvent }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { Cookie: 'dr_session=tok1' },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
    });
  });
});
