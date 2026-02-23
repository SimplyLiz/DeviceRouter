import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProbeEndpoint } from '../endpoint.js';
import type { StorageAdapter } from '@device-router/storage';

function createMockStorage(): StorageAdapter {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
  };
}

function createMockReq(body: unknown, cookies: Record<string, string> = {}) {
  return { body, cookies } as unknown as import('fastify').FastifyRequest;
}

function createMockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setCookie: vi.fn().mockReturnThis(),
  };
  return reply as unknown as import('fastify').FastifyReply;
}

describe('createProbeEndpoint', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('stores profile and returns session token', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 4, deviceMemory: 8 });
    const reply = createMockReply();

    await handler(req, reply);

    expect(storage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaVersion: 1,
        signals: { hardwareConcurrency: 4, deviceMemory: 8 },
      }),
      86400,
    );
    expect(reply.send).toHaveBeenCalledWith({
      ok: true,
      sessionToken: expect.any(String),
    });
    expect(reply.setCookie).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      }),
    );
  });

  it('does not set secure cookie by default', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 4 });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.setCookie).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({ secure: false }),
    );
  });

  it('enables secure cookie when cookieSecure is true', async () => {
    const handler = createProbeEndpoint({ storage, cookieSecure: true });
    const req = createMockReq({ hardwareConcurrency: 4 });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.setCookie).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('reuses existing session token from cookie', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 4 }, { dr_session: 'existing-tok' });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.send).toHaveBeenCalledWith({
      ok: true,
      sessionToken: 'existing-tok',
    });
  });

  it('returns 400 for invalid payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 'not-a-number' });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      ok: false,
      error: 'Invalid probe payload',
    });
  });

  it('returns 400 for non-object payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq('not an object');
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it('handles storage errors gracefully', async () => {
    storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({ hardwareConcurrency: 4 });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      ok: false,
      error: 'Internal server error',
    });
  });

  it('accepts empty signals object when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const req = createMockReq({});
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.send).toHaveBeenCalledWith({
      ok: true,
      sessionToken: expect.any(String),
    });
  });

  it('rejects empty signals as bot by default', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({});
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ ok: false, error: 'Bot detected' });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('rejects bot user-agent', async () => {
    const handler = createProbeEndpoint({ storage });
    const req = createMockReq({
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      viewport: { width: 1024, height: 768 },
    });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('allows bot signals when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const req = createMockReq({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    });
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.send).toHaveBeenCalledWith({
      ok: true,
      sessionToken: expect.any(String),
    });
    expect(storage.set).toHaveBeenCalled();
  });

  describe('onEvent', () => {
    it('emits profile:store after successful storage', async () => {
      const onEvent = vi.fn();
      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({ hardwareConcurrency: 4 });
      const reply = createMockReply();

      await handler(req, reply);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile:store',
          sessionToken: expect.any(String),
          durationMs: expect.any(Number),
        }),
      );
    });

    it('emits bot:reject when bot detected', async () => {
      const onEvent = vi.fn();
      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({});
      const reply = createMockReply();

      await handler(req, reply);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bot:reject',
          sessionToken: expect.any(String),
        }),
      );
    });

    it('emits error event on storage failure', async () => {
      const onEvent = vi.fn();
      storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({ hardwareConcurrency: 4 });
      const reply = createMockReply();

      await handler(req, reply);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          phase: 'endpoint',
        }),
      );
      expect(reply.status).toHaveBeenCalledWith(500);
    });

    it('callback errors do not break endpoint', async () => {
      const onEvent = vi.fn(() => {
        throw new Error('callback boom');
      });
      const handler = createProbeEndpoint({ storage, onEvent });
      const req = createMockReq({ hardwareConcurrency: 4 });
      const reply = createMockReply();

      await handler(req, reply);

      expect(reply.send).toHaveBeenCalledWith({
        ok: true,
        sessionToken: expect.any(String),
      });
    });
  });
});
