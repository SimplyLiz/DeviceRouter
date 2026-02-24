import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMiddleware } from '../middleware.js';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile } from '@device-router/types';

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
  } as unknown as import('fastify').FastifyRequest;
}

function createMockReply() {
  const reply = {
    _headers: {} as Record<string, string>,
    header: vi.fn((name: string, value: string) => {
      reply._headers[name] = value;
      return reply;
    }),
  };
  return reply as unknown as import('fastify').FastifyReply & { _headers: Record<string, string> };
}

describe('createMiddleware', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('sets deviceProfile to null when no cookie', async () => {
    const hook = createMiddleware({ storage });
    const req = createMockReq();

    await hook(req, createMockReply());

    expect(req.deviceProfile).toBeNull();
  });

  it('sets deviceProfile to null when profile not found', async () => {
    const hook = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'unknown' });

    await hook(req, createMockReply());

    expect(req.deviceProfile).toBeNull();
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

    const hook = createMiddleware({ storage });
    const req = createMockReq({ dr_session: 'tok1' });

    await hook(req, createMockReply());

    expect(req.deviceProfile).not.toBeNull();
    expect(req.deviceProfile!.profile).toEqual(profile);
    expect(req.deviceProfile!.tiers.cpu).toBe('high');
    expect(req.deviceProfile!.tiers.memory).toBe('high');
    expect(req.deviceProfile!.hints.deferHeavyComponents).toBe(false);
    expect(req.deviceProfile!.source).toBe('probe');
  });

  it('uses custom cookie name', async () => {
    const hook = createMiddleware({ storage, cookieName: 'custom_session' });
    const req = createMockReq({ custom_session: 'tok' });

    await hook(req, createMockReply());

    expect(storage.get).toHaveBeenCalledWith('tok');
  });

  it('passes custom thresholds to classify', async () => {
    const profile: DeviceProfile = {
      schemaVersion: 1,
      sessionToken: 'tok2',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      signals: { hardwareConcurrency: 4, deviceMemory: 4 },
    };
    storage._store.set('tok2', profile);

    const hook = createMiddleware({
      storage,
      thresholds: { cpu: { lowUpperBound: 6, midUpperBound: 8 } },
    });
    const req = createMockReq({ dr_session: 'tok2' });

    await hook(req, createMockReply());

    expect(req.deviceProfile!.tiers.cpu).toBe('low');
  });

  describe('fallbackProfile', () => {
    it('returns conservative fallback when configured', async () => {
      const hook = createMiddleware({ storage, fallbackProfile: 'conservative' });
      const req = createMockReq();

      await hook(req, createMockReply());

      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers.cpu).toBe('low');
      expect(req.deviceProfile!.tiers.connection).toBe('3g');
      expect(req.deviceProfile!.hints.deferHeavyComponents).toBe(true);
    });

    it('returns optimistic fallback when configured', async () => {
      const hook = createMiddleware({ storage, fallbackProfile: 'optimistic' });
      const req = createMockReq();

      await hook(req, createMockReply());

      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers.cpu).toBe('high');
      expect(req.deviceProfile!.tiers.connection).toBe('high');
    });

    it('returns custom DeviceTiers fallback', async () => {
      const hook = createMiddleware({
        storage,
        fallbackProfile: { cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'low' },
      });
      const req = createMockReq();

      await hook(req, createMockReply());

      expect(req.deviceProfile!.source).toBe('fallback');
      expect(req.deviceProfile!.tiers).toEqual({
        cpu: 'mid',
        memory: 'mid',
        connection: '4g',
        gpu: 'low',
      });
    });

    it('falls back when cookie exists but profile not in storage', async () => {
      const hook = createMiddleware({ storage, fallbackProfile: 'conservative' });
      const req = createMockReq({ dr_session: 'expired-token' });

      await hook(req, createMockReply());

      expect(req.deviceProfile!.source).toBe('fallback');
    });
  });

  describe('classifyFromHeaders', () => {
    it('classifies mobile UA from headers', async () => {
      const hook = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq(
        {},
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
      );

      await hook(req, createMockReply());

      expect(req.deviceProfile!.source).toBe('headers');
      expect(req.deviceProfile!.tiers.cpu).toBe('low');
    });

    it('uses Client Hints when present', async () => {
      const hook = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq(
        {},
        {
          'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
          'device-memory': '2',
          'save-data': 'on',
        },
      );

      await hook(req, createMockReply());

      expect(req.deviceProfile!.tiers.memory).toBe('low');
      expect(req.deviceProfile!.tiers.connection).toBe('3g');
    });

    it('takes priority over fallbackProfile', async () => {
      const hook = createMiddleware({
        storage,
        classifyFromHeaders: true,
        fallbackProfile: 'conservative',
      });
      const req = createMockReq(
        {},
        { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0' },
      );

      await hook(req, createMockReply());

      expect(req.deviceProfile!.source).toBe('headers');
      expect(req.deviceProfile!.tiers.cpu).toBe('high');
    });

    it('sets Accept-CH header when enabled', async () => {
      const hook = createMiddleware({ storage, classifyFromHeaders: true });
      const req = createMockReq();
      const reply = createMockReply();

      await hook(req, reply);

      expect(reply._headers['Accept-CH']).toContain('Device-Memory');
    });

    it('does not set Accept-CH header by default', async () => {
      const hook = createMiddleware({ storage });
      const req = createMockReq();
      const reply = createMockReply();

      await hook(req, reply);

      expect(reply._headers['Accept-CH']).toBeUndefined();
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

      const hook = createMiddleware({ storage, onEvent });
      const req = createMockReq({ dr_session: 'tok1' });

      await hook(req, createMockReply());

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile:classify',
          source: 'probe',
          sessionToken: 'tok1',
          durationMs: expect.any(Number),
        }),
      );
    });

    it('emits profile:classify with source headers when classifyFromHeaders enabled', async () => {
      const onEvent = vi.fn();
      const hook = createMiddleware({ storage, classifyFromHeaders: true, onEvent });
      const req = createMockReq(
        {},
        { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
      );

      await hook(req, createMockReply());

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile:classify',
          source: 'headers',
        }),
      );
    });

    it('emits profile:classify with source fallback when fallbackProfile set', async () => {
      const onEvent = vi.fn();
      const hook = createMiddleware({ storage, fallbackProfile: 'conservative', onEvent });
      const req = createMockReq();

      await hook(req, createMockReply());

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile:classify',
          source: 'fallback',
        }),
      );
    });

    it('does not emit when no profile resolved', async () => {
      const onEvent = vi.fn();
      const hook = createMiddleware({ storage, onEvent });
      const req = createMockReq();

      await hook(req, createMockReply());

      expect(onEvent).not.toHaveBeenCalled();
    });

    it('emits error event on storage failure', async () => {
      const onEvent = vi.fn();
      storage.get = vi.fn().mockRejectedValue(new Error('Redis down'));

      const hook = createMiddleware({ storage, onEvent });
      const req = createMockReq({ dr_session: 'tok1' });

      await expect(hook(req, createMockReply())).rejects.toThrow('Redis down');

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          phase: 'middleware',
          error: expect.any(Error),
        }),
      );
      const event = onEvent.mock.calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'error',
      )![0] as { error: Error };
      expect(event.error.message).toBe('Redis down');
    });

    it('callback errors do not break middleware', async () => {
      const onEvent = vi.fn(() => {
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

      const hook = createMiddleware({ storage, onEvent });
      const req = createMockReq({ dr_session: 'tok1' });

      await hook(req, createMockReply());

      expect(req.deviceProfile).not.toBeNull();
      expect(req.deviceProfile!.source).toBe('probe');
    });
  });
});
