import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createDeviceRouter } from '../index.js';
import type { DeviceRouterEnv } from '../middleware.js';
import { MemoryStorageAdapter } from '@device-router/storage';

describe('integration: probe → middleware → route (hono)', () => {
  let app: Hono<DeviceRouterEnv>;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    app = new Hono<DeviceRouterEnv>();

    const { middleware, probeEndpoint } = createDeviceRouter({ storage });

    app.post('/device-router/probe', probeEndpoint);
    app.use('*', middleware);

    app.get('/test', (c) => {
      const dp = c.get('deviceProfile');
      if (dp) {
        return c.json({
          tier: dp.tiers.cpu,
          hints: dp.hints,
        });
      }
      return c.json({ tier: null });
    });
  });

  it('returns null tier when no probe has been sent', async () => {
    const res = await app.request('/test');
    const data = (await res.json()) as { tier: string | null };
    expect(data.tier).toBeNull();
  });

  it('full flow: probe → get profile on next request', async () => {
    const probeRes = await app.request('/device-router/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hardwareConcurrency: 8,
        deviceMemory: 8,
        connection: { effectiveType: '4g', downlink: 50 },
      }),
    });

    const probeData = (await probeRes.json()) as { ok: boolean; sessionToken: string };
    expect(probeData.ok).toBe(true);
    expect(probeData.sessionToken).toBeTruthy();

    const testRes = await app.request('/test', {
      headers: { Cookie: `dr_session=${probeData.sessionToken}` },
    });

    const testData = (await testRes.json()) as { tier: string; hints: Record<string, boolean> };
    expect(testData.tier).toBe('high');
    expect(testData.hints.deferHeavyComponents).toBe(false);
  });
});

describe('integration: probe injection (hono)', () => {
  let app: Hono<DeviceRouterEnv>;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    app = new Hono<DeviceRouterEnv>();

    const { middleware, injectionMiddleware } = createDeviceRouter({
      storage,
      injectProbe: true,
    });

    if (injectionMiddleware) {
      app.use('*', injectionMiddleware);
    }
    app.use('*', middleware);

    app.get('/html', (c) => c.html('<html><head><title>Test</title></head><body></body></html>'));
    app.get('/json', (c) => c.json({ ok: true }));
  });

  it('injects probe script into HTML responses', async () => {
    const res = await app.request('/html');
    const body = await res.text();
    expect(body).toContain('<script>');
    expect(body).toContain('</script></head>');
  });

  it('does not inject into JSON responses', async () => {
    const res = await app.request('/json');
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
