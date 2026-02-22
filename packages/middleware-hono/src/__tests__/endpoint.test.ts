import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
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

describe('createProbeEndpoint (hono)', () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('stores profile and returns session token', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hardwareConcurrency: 4, deviceMemory: 8 }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; sessionToken: string };
    expect(data.ok).toBe(true);
    expect(data.sessionToken).toBeTruthy();

    expect(storage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schemaVersion: 1,
        signals: { hardwareConcurrency: 4, deviceMemory: 8 },
      }),
      86400,
    );

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('dr_session=');
  });

  it('returns 400 for invalid payload', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hardwareConcurrency: 'not-a-number' }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
  });

  it('accepts empty signals object', async () => {
    const app = new Hono();
    app.post('/probe', createProbeEndpoint({ storage }));

    const res = await app.request('/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
