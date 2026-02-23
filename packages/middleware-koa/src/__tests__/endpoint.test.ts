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

function createMockCtx(body: unknown, cookies: Record<string, string> = {}) {
  return {
    request: { body },
    cookies: {
      get: vi.fn((name: string) => cookies[name]),
      set: vi.fn(),
    },
    status: 200,
    body: undefined as unknown,
  } as unknown as import('koa').Context;
}

describe('createProbeEndpoint (koa)', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('stores profile and returns session token', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4, deviceMemory: 8 });

    await handler(ctx);

    expect(storage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaVersion: 1,
        signals: { hardwareConcurrency: 4, deviceMemory: 8 },
      }),
      86400,
    );
    expect((ctx.body as { ok: boolean }).ok).toBe(true);
    expect((ctx.body as { sessionToken: string }).sessionToken).toBeTruthy();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      'dr_session',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
      }),
    );
  });

  it('reuses existing session token from cookie', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4 }, { dr_session: 'existing-tok' });

    await handler(ctx);

    expect((ctx.body as { sessionToken: string }).sessionToken).toBe('existing-tok');
  });

  it('returns 400 for invalid payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 'not-a-number' });

    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect((ctx.body as { ok: boolean }).ok).toBe(false);
  });

  it('returns 400 for non-object payload', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx('not an object');

    await handler(ctx);

    expect(ctx.status).toBe(400);
  });

  it('handles storage errors gracefully', async () => {
    storage.set = vi.fn().mockRejectedValue(new Error('Redis down'));
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({ hardwareConcurrency: 4 });

    await handler(ctx);

    expect(ctx.status).toBe(500);
    expect((ctx.body as { ok: boolean; error: string }).error).toBe('Internal server error');
  });

  it('accepts empty signals object when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const ctx = createMockCtx({});

    await handler(ctx);

    expect((ctx.body as { ok: boolean }).ok).toBe(true);
  });

  it('rejects empty signals as bot by default', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({});

    await handler(ctx);

    expect(ctx.status).toBe(403);
    expect((ctx.body as { error: string }).error).toBe('Bot detected');
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('rejects bot user-agent', async () => {
    const handler = createProbeEndpoint({ storage });
    const ctx = createMockCtx({
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      viewport: { width: 1024, height: 768 },
    });

    await handler(ctx);

    expect(ctx.status).toBe(403);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('allows bot signals when rejectBots is false', async () => {
    const handler = createProbeEndpoint({ storage, rejectBots: false });
    const ctx = createMockCtx({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    });

    await handler(ctx);

    expect((ctx.body as { ok: boolean }).ok).toBe(true);
    expect(storage.set).toHaveBeenCalled();
  });
});
