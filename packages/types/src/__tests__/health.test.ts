import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProbeHealthCheck, NO_PROBE_DATA_THRESHOLD } from '../health.js';

describe('createProbeHealthCheck', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('warns after threshold middleware hits with no probe', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const health = createProbeHealthCheck({ probePath: '/device-router/probe' });

    for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
      health.onMiddlewareHit();
    }

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${NO_PROBE_DATA_THRESHOLD} requests handled`),
    );
  });

  it('does not warn before reaching threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const health = createProbeHealthCheck({ probePath: '/device-router/probe' });

    for (let i = 0; i < NO_PROBE_DATA_THRESHOLD - 1; i++) {
      health.onMiddlewareHit();
    }

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns only once even after many more hits', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const health = createProbeHealthCheck({ probePath: '/device-router/probe' });

    for (let i = 0; i < NO_PROBE_DATA_THRESHOLD * 3; i++) {
      health.onMiddlewareHit();
    }

    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('does not warn if probe is received before threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const health = createProbeHealthCheck({ probePath: '/device-router/probe' });

    for (let i = 0; i < 10; i++) {
      health.onMiddlewareHit();
    }
    health.onProbeReceived();
    for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
      health.onMiddlewareHit();
    }

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits diagnostic:no-probe-data event at threshold', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEvent = vi.fn();
    const health = createProbeHealthCheck({ onEvent, probePath: '/custom/probe' });

    for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
      health.onMiddlewareHit();
    }

    expect(onEvent).toHaveBeenCalledWith({
      type: 'diagnostic:no-probe-data',
      middlewareInvocations: NO_PROBE_DATA_THRESHOLD,
      probePath: '/custom/probe',
    });
  });

  it('does not emit event if no onEvent callback provided', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const health = createProbeHealthCheck({ probePath: '/device-router/probe' });

    expect(() => {
      for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
        health.onMiddlewareHit();
      }
    }).not.toThrow();
  });

  it('includes probe path in warning message', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const health = createProbeHealthCheck({ probePath: '/my/custom/path' });

    for (let i = 0; i < NO_PROBE_DATA_THRESHOLD; i++) {
      health.onMiddlewareHit();
    }

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/my/custom/path'));
  });
});
