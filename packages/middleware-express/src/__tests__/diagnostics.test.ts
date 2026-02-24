import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '../index.js';
import { MemoryStorageAdapter } from '@device-router/storage';
import { NO_PROBE_DATA_THRESHOLD } from '@device-router/types';
import type { Server } from 'node:http';

describe('diagnostics (express)', () => {
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
    let app: ReturnType<typeof express>;
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    async function setup(opts: { onEvent?: (e: unknown) => void } = {}) {
      const storage = new MemoryStorageAdapter();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      app = express();
      app.use(cookieParser());
      app.use(express.json());

      const { middleware, probeEndpoint } = createDeviceRouter({
        storage,
        onEvent: opts.onEvent,
      });

      app.post('/device-router/probe', probeEndpoint);
      app.use(middleware);
      app.get('/test', (_req, res) => res.json({ ok: true }));

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
    }

    it('warns after threshold middleware hits with no probe', async () => {
      await setup();
      const warnSpy = vi.mocked(console.warn);

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${NO_PROBE_DATA_THRESHOLD} requests handled`),
      );
    });

    it('does not warn if probe is received before threshold', async () => {
      await setup();
      const warnSpy = vi.mocked(console.warn);

      // Send probe first
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
      await setup();
      const warnSpy = vi.mocked(console.warn);

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 2; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('is silent in production', async () => {
      process.env.NODE_ENV = 'production';
      vi.restoreAllMocks();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = new MemoryStorageAdapter();

      app = express();
      app.use(cookieParser());

      const { middleware } = createDeviceRouter({ storage });
      app.use(middleware);
      app.get('/test', (_req, res) => res.json({ ok: true }));

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }

      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 2; i++) {
        await fetch(`${baseUrl}/test`);
      }

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Strategy C: onEvent callback', () => {
    let server: Server;

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('emits diagnostic:no-probe-data through onEvent', async () => {
      process.env.NODE_ENV = 'development';
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onEvent = vi.fn();
      const storage = new MemoryStorageAdapter();

      const app = express();
      app.use(cookieParser());
      const { middleware } = createDeviceRouter({ storage, onEvent });
      app.use(middleware);
      app.get('/test', (_req, res) => res.json({ ok: true }));

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => resolve());
      });
      const addr = server.address();
      let baseUrl = '';
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }

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
