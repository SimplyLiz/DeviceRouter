import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMiddleware } from '../middleware.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, DeviceRouterEvent } from '@device-router/types';

function createMockStorage(): StorageAdapter {
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

function createMockReq(cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return {
    cookies,
    headers,
    deviceProfile: undefined,
  } as unknown as import('express').Request;
}

function createMockRes() {
  const res = {
    _headers: {} as Record<string, string>,
    setHeader: vi.fn((name: string, value: string) => {
      res._headers[name] = value;
    }),
  };
  return res as unknown as import('express').Response & { _headers: Record<string, string> };
}

describe('createMiddleware', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('sets deviceProfile to null when no cookie', async () => {
    const mw = createMiddleware({ storage });
    const req = createMockReq();
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(req.deviceProfile).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('sets deviceProfile to null when profile not found', async () => {
    const mw = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'unknown' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(req.deviceProfile).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('attaches classified profile when found', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 8, deviceMemory: 8 },
    };
    (storage as unknown as { _store: Map<string, DeviceProfile> })._store.set('tok1', profile);

    const mw = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'tok1' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(req.deviceProfile).not.toBeNull();
    expect(req.deviceProfile!.profile).toEqual(profile);
    expect(req.deviceProfile!.tiers.cpu).toBe('high');
    expect(req.deviceProfile!.tiers.memory).toBe('high');
    expect(req.deviceProfile!.hints.deferHeavyComponents).toBe(false);
    expect(req.deviceProfile!.source).toBe('probe');
    expect(next).toHaveBeenCalledWith();
  });

  it('uses custom cookie name', async () => {
    const mw = createMiddleware({ storage, cookieName: 'custom_session' });
    const req = createMockReq({ custom_session: 'tok' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(storage.get).toHaveBeenCalledWith('tok');
    expect(next).toHaveBeenCalled();
  });

  it('calls next with error on storage failure', async () => {
    storage.get = vi.fn().mockRejectedValue(new Error('Storage down'));
    const mw = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'tok' });
    const next = vi.fn();

    await mw(req, createMockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('passes custom thresholds to classify', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 4, deviceMemory: 4 },
    };
    (storage as unknown as { _store: Map<string, DeviceProfile> })._store.set('tok2', profile);

    // Default thresholds: 4 cores = mid, 4 GB = mid
    const mwDefault = createMiddleware({ storage });
    const req1 = createMockReq({ dr_session: 'tok2' });
    await mwDefault(req1, createMockRes(), vi.fn());
    expect(req1.deviceProfile!.tiers.cpu).toBe('mid');
    expect(req1.deviceProfile!.tiers.memory).toBe('mid');

    // Custom thresholds: raise lowUpperBound to 6 → 4 cores = low
    const mwCustom = createMiddleware({
      storage,
      thresholds: {
        cpu: { lowUpperBound: 6, midUpperBound: 8 },
        memory: { lowUpperBound: 6, midUpperBound: 8 },
      },
    });
    const req2 = createMockReq({ dr_session: 'tok2' });
    await mwCustom(req2, createMockRes(), vi.fn());
    expect(req2.deviceProfile!.tiers.cpu).toBe('low');
    expect(req2.deviceProfile!.tiers.memory).toBe('low');
  });

  describe('fallbackProfile', () => {
    it('returns conservative fallback when configured', async () => {
      const mw = createMiddleware({ storage, fallbackProfile: 'conservative' });
      const req = createMockReq();
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile).not.toBeNull();
      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers.cpu).toBe('low');
      expect(req.deviceProfile!.tiers.memory).toBe('low');
      expect(req.deviceProfile!.tiers.connection).toBe('3g');
      expect(req.deviceProfile!.hints.deferHeavyComponents).toBe(true);
    });

    it('returns optimistic fallback when configured', async () => {
      const mw = createMiddleware({ storage, fallbackProfile: 'optimistic' });
      const req = createMockReq();
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile).not.toBeNull();
      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers.cpu).toBe('high');
      expect(req.deviceProfile!.tiers.memory).toBe('high');
      expect(req.deviceProfile!.tiers.connection).toBe('high');
    });

    it('returns custom DeviceTiers fallback', async () => {
      const mw = createMiddleware({
        storage,
        fallbackProfile: { cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'low' },
      });
      const req = createMockReq();
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers).toEqual({
        cpu: 'mid',
        memory: 'mid',
        connection: '4g',
        gpu: 'low',
      });
    });

    it('falls back when cookie exists but profile not in storage', async () => {
      const mw = createMiddleware({ storage, fallbackProfile: 'conservative' });
      const req = createMockReq({ dr_session: 'expired-token' });
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers.cpu).toBe('low');
    });
  });

  describe('classifyFromHeaders', () => {
    it('classifies mobile UA from headers', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq(
        {},
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
      );
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile).not.toBeNull();
      expect(req.deviceProfile!.source).toBe('headers');
      expect(req.deviceProfile!.tiers.cpu).toBe('low');
      expect(req.deviceProfile!.tiers.memory).toBe('low');
    });

    it('uses Client Hints when present', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq(
        {},
        {
          'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
          'device-memory': '2',
          'save-data': 'on',
        },
      );
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile!.source).toBe('headers');
      expect(req.deviceProfile!.tiers.memory).toBe('low');
      expect(req.deviceProfile!.tiers.connection).toBe('3g');
    });

    it('takes priority over fallbackProfile', async () => {
      const mw = createMiddleware({
        storage,
        classifyFromHeaders: true,
        fallbackProfile: 'conservative',
      });
      const req = createMockReq(
        {},
        { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0' },
      );
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile!.source).toBe('headers');
      expect(req.deviceProfile!.tiers.cpu).toBe('high');
    });

    it('sets Accept-CH header when enabled', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      await mw(req, res, next);

      expect(res._headers['Accept-CH']).toContain('Sec-CH-UA-Mobile');
      expect(res._headers['Accept-CH']).toContain('Device-Memory');
    });

    it('does not set Accept-CH header by default', async () => {
      const mw = createMiddleware({ storage });
      const req = createMockReq();
      const res = createMockRes();
      const next = vi.fn();

      await mw(req, res, next);

      expect(res._headers['Accept-CH']).toBeUndefined();
    });

    it('classifies from headers when cookie exists but storage misses', async () => {
      const mw = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq(
        { dr_session: 'expired' },
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile' },
      );
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(req.deviceProfile!.source).toBe('headers');
    });
  });

  describe('onEvent', () => {
    it('emits profile:classify with source probe when profile found in storage', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken: 'tok-ev1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        signals: { hardwareConcurrency: 8, deviceMemory: 8 },
      };
      (storage as unknown as { _store: Map<string, DeviceProfile> })._store.set('tok-ev1', profile);

      const mw = createMiddleware({ storage, onEvent });
      const req = createMockReq({ dr_session: 'tok-ev1' });
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('profile:classify');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'profile:classify' }>;
      expect(event.source).toBe('probe');
      expect(event.sessionToken).toBe('tok-ev1');
      expect(typeof event.durationMs).toBe('number');
    });

    it('emits profile:classify with source headers when classifyFromHeaders enabled', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const mw = createMiddleware({ storage, classifyFromHeaders: true, onEvent });
      const req = createMockReq(
        {},
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
      );
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('profile:classify');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'profile:classify' }>;
      expect(event.source).toBe('headers');
    });

    it('emits profile:classify with source fallback when fallbackProfile set', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      const mw = createMiddleware({ storage, fallbackProfile: 'conservative', onEvent });
      const req = createMockReq();
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('profile:classify');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'profile:classify' }>;
      expect(event.source).toBe('fallback');
    });

    it('does not emit when no profile resolved', async () => {
      const onEvent = vi.fn();

      const mw = createMiddleware({ storage, onEvent });
      const req = createMockReq();
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(onEvent).not.toHaveBeenCalled();
    });

    it('emits error event on storage failure', async () => {
      const events: DeviceRouterEvent[] = [];
      const onEvent = vi.fn((e: DeviceRouterEvent) => {
        events.push(e);
      });

      storage.get = vi.fn().mockRejectedValue(new Error('Storage down'));
      const mw = createMiddleware({ storage, onEvent });
      const req = createMockReq({ dr_session: 'tok-err' });
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(onEvent).toHaveBeenCalledOnce();
      expect(events[0].type).toBe('error');
      const event = events[0] as Extract<DeviceRouterEvent, { type: 'error' }>;
      expect(event.phase).toBe('middleware');
      expect(event.error).toBeInstanceOf(Error);
      expect((event.error as Error).message).toBe('Storage down');
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('callback errors do not break middleware', async () => {
      const onEvent = vi.fn(() => {
        throw new Error('callback boom');
      });

      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken: 'tok-safe',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        signals: { hardwareConcurrency: 8, deviceMemory: 8 },
      };
      (storage as unknown as { _store: Map<string, DeviceProfile> })._store.set(
        'tok-safe',
        profile,
      );

      const mw = createMiddleware({ storage, onEvent });
      const req = createMockReq({ dr_session: 'tok-safe' });
      const next = vi.fn();

      await mw(req, createMockRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});
