import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Koa from 'koa';
import { createDeviceRouter } from '../index.js';
import { MemoryStorageAdapter } from '@device-router/storage';
import type { Server } from 'node:http';

describe('integration: probe → middleware → route (koa)', () => {
  let app: Koa;
  let server: Server;
  let baseUrl: string;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    app = new Koa();

    const { middleware, probeEndpoint } = createDeviceRouter({ storage });

    // Simple body parser for JSON
    app.use(async (ctx, next) => {
      if (ctx.method === 'POST' && ctx.is('application/json')) {
        const body = await new Promise<string>((resolve) => {
          let data = '';
          ctx.req.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          ctx.req.on('end', () => resolve(data));
        });
        (ctx.request as unknown as { body: unknown }).body = JSON.parse(body);
      }
      await next();
    });

    app.use(async (ctx, next) => {
      if (ctx.path === '/device-router/probe' && ctx.method === 'POST') {
        await probeEndpoint(ctx);
        return;
      }
      await next();
    });

    app.use(middleware);

    app.use(async (ctx) => {
      if (ctx.path === '/test' && ctx.method === 'GET') {
        if (ctx.state.deviceProfile) {
          ctx.body = {
            tier: ctx.state.deviceProfile.tiers.cpu,
            hints: ctx.state.deviceProfile.hints,
          };
        } else {
          ctx.body = { tier: null };
        }
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
