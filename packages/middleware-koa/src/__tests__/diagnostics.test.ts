import { describe, it, expect, vi, afterEach } from 'vitest';
import Koa from 'koa';
import { createDeviceRouter } from '../index.js';
import { MemoryStorageAdapter } from '@device-router/storage';
import { NO_PROBE_DATA_THRESHOLD } from '@device-router/types';
import type { Server } from 'node:http';

describe('diagnostics (koa)', () => {
  const originalEnv = process.env.NODE_ENV;
  let server: Server | undefined;

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  async function listen(app: Koa): Promise<string> {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (typeof addr === 'object' && addr) {
      return `http://127.0.0.1:${addr.port}`;
    }
    throw new Error('Failed to get server address');
  }

  describe('Strategy A: startup log', () => {
    it('logs probe path at startup in non-production', () => {
      process.env.NODE_ENV = 'development';
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      createDeviceRouter({ storage });

      expect(infoSpy).toHaveBeenCalledWith(
        '[DeviceRouter] Probe endpoint expected at POST /device-router/probe',
      );
    });

    it('logs custom probe path', () => {
      process.env.NODE_ENV = 'development';
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      createDeviceRouter({ storage, probePath: '/custom/probe' });

      expect(infoSpy).toHaveBeenCalledWith(
        '[DeviceRouter] Probe endpoint expected at POST /custom/probe',
      );
    });

    it('does not log in production', () => {
      process.env.NODE_ENV = 'production';
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      createDeviceRouter({ storage });

      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('Strategy B: runtime warning', () => {
    it('warns after threshold middleware hits with no probe', async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      const app = new Koa();
      const { middleware } = createDeviceRouter({ storage });
      app.use(middleware);
      app.use(async (ctx) => {
        ctx.body = { ok: true };
      });

      const baseUrl = await listen(app);

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${NO_PROBE_DATA_THRESHOLD} requests handled`),
      );
    });

    it('does not warn if probe is received before threshold', async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      const app = new Koa();
      const { middleware, probeEndpoint } = createDeviceRouter({ storage });

      // Body parser
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
        ctx.body = { ok: true };
      });

      const baseUrl = await listen(app);

      await fetch(`${baseUrl}/device-router/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardwareConcurrency: 4,
          deviceMemory: 4,
          connection: { effectiveType: '4g', downlink: 10 },
        }),
      });

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns only once', async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      const app = new Koa();
      const { middleware } = createDeviceRouter({ storage });
      app.use(middleware);
      app.use(async (ctx) => {
        ctx.body = { ok: true };
      });

      const baseUrl = await listen(app);

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 2; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('is silent in production', async () => {
      process.env.NODE_ENV = 'production';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      const app = new Koa();
      const { middleware } = createDeviceRouter({ storage });
      app.use(middleware);
      app.use(async (ctx) => {
        ctx.body = { ok: true };
      });

      const baseUrl = await listen(app);

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 2; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Strategy C: onEvent callback', () => {
    it('emits diagnostic:no-probe-data through onEvent', async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onEvent = vi.fn();
      const storage = new MemoryStorageAdapter();

      const app = new Koa();
      const { middleware } = createDeviceRouter({ storage, onEvent });
      app.use(middleware);
      app.use(async (ctx) => {
        ctx.body = { ok: true };
      });

      const baseUrl = await listen(app);

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'diagnostic:no-probe-data',
          middlewareInvocations: NO_PROBE_DATA_THRESHOLD,
          probePath: '/device-router/probe',
        }),
      );
    });
  });
});
