import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runProbe } from '../probe.js';

describe('runProbe', () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
      value: { cookie: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 4,
        userAgent: 'Test/1.0',
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        innerWidth: 1024,
        innerHeight: 768,
        devicePixelRatio: 2,
        matchMedia: vi.fn(() => ({ matches: false })),
      },
      writable: true,
      configurable: true,
    });
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('skips probe when session cookie exists', async () => {
    Object.defineProperty(globalThis, 'document', {
      value: { cookie: 'dr_session=abc123' },
      writable: true,
      configurable: true,
    });

    await runProbe();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('collects signals and posts to endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'new-token' }),
    });
    globalThis.fetch = mockFetch;

    await runProbe();

    expect(mockFetch).toHaveBeenCalledWith('/device-router/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.hardwareConcurrency).toBe(4);
  });

  it('sets session cookie on successful response', async () => {
    const mockDoc = { cookie: '' };
    Object.defineProperty(globalThis, 'document', {
      value: mockDoc,
      writable: true,
      configurable: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'test-token' }),
    });

    await runProbe();

    expect(mockDoc.cookie).toContain('dr_session=test-token');
  });

  it('uses custom endpoint and cookie name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok' }),
    });

    await runProbe({
      endpoint: '/custom/probe',
      cookieName: 'custom_session',
      cookiePath: '/app',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/custom/probe', expect.any(Object));
  });

  it('silently fails on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(runProbe()).resolves.toBeUndefined();
  });

  it('includes battery when getBattery resolves', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 4,
        userAgent: 'Test/1.0',
        getBattery: () => Promise.resolve({ level: 0.72, charging: true }),
      },
      writable: true,
      configurable: true,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok' }),
    });
    globalThis.fetch = mockFetch;

    await runProbe();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.battery).toEqual({ level: 0.72, charging: true });
  });

  it('omits battery when getBattery is unavailable', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok' }),
    });
    globalThis.fetch = mockFetch;

    await runProbe();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.battery).toBeUndefined();
  });

  it('omits battery when getBattery rejects', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        hardwareConcurrency: 4,
        userAgent: 'Test/1.0',
        getBattery: () => Promise.reject(new Error('not supported')),
      },
      writable: true,
      configurable: true,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok' }),
    });
    globalThis.fetch = mockFetch;

    await runProbe();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.battery).toBeUndefined();
  });

  it('does not set cookie on non-ok response', async () => {
    const mockDoc = { cookie: '' };
    Object.defineProperty(globalThis, 'document', {
      value: mockDoc,
      writable: true,
      configurable: true,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await runProbe();

    expect(mockDoc.cookie).toBe('');
  });
});
