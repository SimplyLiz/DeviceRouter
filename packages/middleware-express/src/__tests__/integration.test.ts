import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '../index.js';
import { MemoryStorageAdapter } from '@device-router/storage';
import type { Server } from 'node:http';

function request(
  url: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  return fetch(url, options);
}

describe('integration: probe → middleware → route', () => {
  let app: ReturnType<typeof express>;
  let server: Server;
  let baseUrl: string;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    app = express();
    app.use(cookieParser());
    app.use(express.json());

    const { middleware, probeEndpoint } = createDeviceRouter({ storage });

    app.post('/device-router/probe', probeEndpoint);
    app.use(middleware);

    app.get('/test', (req, res) => {
      if (req.deviceProfile) {
        res.json({
          tier: req.deviceProfile.tiers.cpu,
          hints: req.deviceProfile.hints,
        });
      } else {
        res.json({ tier: null });
      }
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterEach(async () => {
    storage.clear();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns null tier when no probe has been sent', async () => {
    const res = await request(`${baseUrl}/test`);
    const data = (await res.json()) as { tier: string | null };
    expect(data.tier).toBeNull();
  });

  it('full flow: probe → get profile on next request', async () => {
    // Step 1: Send probe
    const probeRes = await request(`${baseUrl}/device-router/probe`, {
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

    // Extract session cookie from Set-Cookie header
    const setCookie = probeRes.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();

    // Step 2: Make request with session cookie
    const testRes = await request(`${baseUrl}/test`, {
      headers: { Cookie: `dr_session=${probeData.sessionToken}` },
    });

    const testData = (await testRes.json()) as { tier: string; hints: Record<string, boolean> };
    expect(testData.tier).toBe('high');
    expect(testData.hints.deferHeavyComponents).toBe(false);
  });
});

describe('integration: probe injection (express)', () => {
  let app: ReturnType<typeof express>;
  let server: Server;
  let baseUrl: string;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    app = express();
    app.use(cookieParser());
    app.use(express.json());

    const { middleware, injectionMiddleware } = createDeviceRouter({
      storage,
      injectProbe: true,
    });

    if (injectionMiddleware) {
      app.use(injectionMiddleware);
    }
    app.use(middleware);

    app.get('/html', (_req, res) => {
      res.type('html').send('<html><head><title>Test</title></head><body></body></html>');
    });

    app.get('/json', (_req, res) => {
      res.json({ ok: true });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterEach(async () => {
    storage.clear();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('injects probe script into HTML responses', async () => {
    const res = await request(`${baseUrl}/html`);
    const body = await res.text();
    expect(body).toContain('<script>');
    expect(body).toContain('</script></head>');
  });

  it('does not inject into JSON responses', async () => {
    const res = await request(`${baseUrl}/json`);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
