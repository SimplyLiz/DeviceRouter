import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runProbeWithRetry } from '../retry.js';

describe('runProbeWithRetry', () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('succeeds on first attempt without retry', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sessionToken: 'tok1' }),
    });
    globalThis.fetch = mockFetch;

    await runProbeWithRetry();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/device-router/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    });
  });

  it('retries on network failure and succeeds on 2nd attempt', async () => {
    const mockDoc = { cookie: '' };
    Object.defineProperty(globalThis, 'document', {
      value: mockDoc,
      writable: true,
      configurable: true,
    });

    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionToken: 'retry-tok' }),
      });
    globalThis.fetch = mockFetch;

    await runProbeWithRetry({ retry: { baseDelay: 10, maxDelay: 100 } });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockDoc.cookie).toContain('device-router-session=retry-tok');
  });

  it('exhausts retries and fails silently', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    globalThis.fetch = mockFetch;

    await expect(
      runProbeWithRetry({ retry: { maxRetries: 2, baseDelay: 10, maxDelay: 50 } }),
    ).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('respects maxRetries option', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('fail'));
    globalThis.fetch = mockFetch;

    await runProbeWithRetry({ retry: { maxRetries: 1, baseDelay: 10, maxDelay: 50 } });

    expect(mockFetch).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('backoff delay increases exponentially', async () => {
    const delays: number[] = [];

    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionToken: 'tok' }),
      });
    globalThis.fetch = mockFetch;

    // Use real timers to track actual delay values
    vi.useRealTimers();

    const sleepSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms: number,
    ) => {
      delays.push(ms);
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    await runProbeWithRetry({ retry: { baseDelay: 100, maxDelay: 5000 } });

    sleepSpy.mockRestore();

    // First delay: baseDelay * 2^0 + jitter = 100..200
    // Second delay: baseDelay * 2^1 + jitter = 200..300
    expect(delays.length).toBe(2);
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[0]).toBeLessThan(200);
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[1]).toBeLessThan(300);
    // Second delay should be larger
    expect(delays[1]).toBeGreaterThan(delays[0]);
  });

  it('retries on 500 server error', async () => {
    const mockDoc = { cookie: '' };
    Object.defineProperty(globalThis, 'document', {
      value: mockDoc,
      writable: true,
      configurable: true,
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionToken: 'recovered' }),
      });
    globalThis.fetch = mockFetch;

    await runProbeWithRetry({ retry: { baseDelay: 10, maxDelay: 100 } });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockDoc.cookie).toContain('device-router-session=recovered');
  });

  it('does not retry on 400 client error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    globalThis.fetch = mockFetch;

    await runProbeWithRetry({ retry: { maxRetries: 3, baseDelay: 10, maxDelay: 50 } });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries on persistent 503', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    globalThis.fetch = mockFetch;

    await runProbeWithRetry({ retry: { maxRetries: 2, baseDelay: 10, maxDelay: 50 } });

    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('skips if session cookie exists', async () => {
    Object.defineProperty(globalThis, 'document', {
      value: { cookie: 'device-router-session=existing' },
      writable: true,
      configurable: true,
    });

    await runProbeWithRetry();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
