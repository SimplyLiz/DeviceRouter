import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createDeviceRouter } from '../index.js';
import type { DeviceRouterEnv } from '../middleware.js';
import { MemoryStorageAdapter } from '@device-router/storage';
import { NO_PROBE_DATA_THRESHOLD } from '@device-router/types';

describe('diagnostics (hono)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

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

      const app = new Hono<DeviceRouterEnv>();
      const { middleware } = createDeviceRouter({ storage });
      app.use('*', middleware);
      app.get('/test', (c) => c.json({ ok: true }));

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await app.request('/test');
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

      const app = new Hono<DeviceRouterEnv>();
      const { middleware, probeEndpoint } = createDeviceRouter({ storage });
      app.post('/device-router/probe', probeEndpoint);
      app.use('*', middleware);
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/device-router/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardwareConcurrency: 4,
          deviceMemory: 4,
          connection: { effectiveType: '4g', downlink: 10 },
        }),
      });

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await app.request('/test');
      }

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns only once', async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      const app = new Hono<DeviceRouterEnv>();
      const { middleware } = createDeviceRouter({ storage });
      app.use('*', middleware);
      app.get('/test', (c) => c.json({ ok: true }));

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 2; i++) {
        await app.request('/test');
      }

      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('is silent in production', async () => {
      process.env.NODE_ENV = 'production';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      const app = new Hono<DeviceRouterEnv>();
      const { middleware } = createDeviceRouter({ storage });
      app.use('*', middleware);
      app.get('/test', (c) => c.json({ ok: true }));

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 2; i++) {
        await app.request('/test');
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

      const app = new Hono<DeviceRouterEnv>();
      const { middleware } = createDeviceRouter({ storage, onEvent });
      app.use('*', middleware);
      app.get('/test', (c) => c.json({ ok: true }));

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await app.request('/test');
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
