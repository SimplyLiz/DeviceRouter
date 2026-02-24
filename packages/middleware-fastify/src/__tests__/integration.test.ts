import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createDeviceRouter } from '../index.js';
import { MemoryStorageAdapter } from '@device-router/storage';
import type { FastifyInstance } from 'fastify';

describe('integration: probe → middleware → route (fastify)', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    app = Fastify();
    await app.register(cookie);

    const { middleware, probeEndpoint } = createDeviceRouter({ storage });

    app.post('/device-router/probe', probeEndpoint);
    app.addHook('preHandler', middleware);

    app.get('/test', (req, reply) => {
      if (req.deviceProfile) {
        reply.send({
          tier: req.deviceProfile.tiers.cpu,
          hints: req.deviceProfile.hints,
        });
      } else {
        reply.send({ tier: null });
      }
    });

    await app.listen({ port: 0 });
    const addr = app.server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterEach(async () => {
    storage.clear();
    await app.close();
  });

  it('returns null tier when no probe has been sent', async () => {
    const res = await fetch(`${baseUrl}/test`);
    const data = (await res.json()) as { tier: string | null };
    expect(data.tier).toBeNull();
  });

  it('full flow: probe → get profile on next request', async () => {
    const probeRes = await fetch(`${baseUrl}/device-router/probe`, {
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

    const setCookie = probeRes.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();

    const testRes = await fetch(`${baseUrl}/test`, {
      headers: { Cookie: `dr_session=${probeData.sessionToken}` },
    });

    const testData = (await testRes.json()) as { tier: string; hints: Record<string, boolean> };
    expect(testData.tier).toBe('high');
    expect(testData.hints.deferHeavyComponents).toBe(false);
  });
});

describe('integration: probe injection (fastify)', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    app = Fastify();
    await app.register(cookie);

    const { middleware, injectionMiddleware } = createDeviceRouter({
      storage,
      injectProbe: true,
    });

    app.addHook('preHandler', middleware);
    if (injectionMiddleware) {
      app.addHook('onSend', injectionMiddleware);
    }

    app.get('/html', (_req, reply) => {
      reply.type('text/html').send('<html><head><title>Test</title></head><body></body></html>');
    });

    app.get('/json', (_req, reply) => {
      reply.send({ ok: true });
    });

    await app.listen({ port: 0 });
    const addr = app.server.address();
    if (typeof addr === 'object' && addr) {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterEach(async () => {
    storage.clear();
    await app.close();
  });

  it('injects probe script into HTML responses', async () => {
    const res = await fetch(`${baseUrl}/html`);
    const body = await res.text();
    expect(body).toContain('<script>');
    expect(body).toContain('</script></head>');
  });

  it('does not inject into JSON responses', async () => {
    const res = await fetch(`${baseUrl}/json`);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
