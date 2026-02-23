import { describe, it, expect, vi } from 'vitest';
import { emitEvent } from '../events.js';
import type { DeviceRouterEvent } from '../events.js';

const sampleEvent: DeviceRouterEvent = {
  type: 'profile:classify',
  sessionToken: 'tok1',
  tiers: { cpu: 'high', memory: 'high', connection: 'fast', gpu: 'mid' },
  hints: {
    deferHeavyComponents: false,
    serveMinimalCSS: false,
    reduceAnimations: false,
    useImagePlaceholders: false,
    disableAutoplay: false,
    preferServerRendering: false,
    disable3dEffects: false,
  },
  source: 'probe',
  durationMs: 5,
};

describe('emitEvent', () => {
  it('calls the callback with the event', () => {
    const cb = vi.fn();
    emitEvent(cb, sampleEvent);
    expect(cb).toHaveBeenCalledWith(sampleEvent);
  });

  it('no-ops when callback is undefined', () => {
    expect(() => emitEvent(undefined, sampleEvent)).not.toThrow();
  });

  it('swallows synchronous throws', () => {
    const cb = vi.fn(() => {
      throw new Error('boom');
    });
    expect(() => emitEvent(cb, sampleEvent)).not.toThrow();
    expect(cb).toHaveBeenCalled();
  });

  it('swallows async rejections', async () => {
    const cb = vi.fn(() => Promise.reject(new Error('async boom')));
    expect(() => emitEvent(cb, sampleEvent)).not.toThrow();
    expect(cb).toHaveBeenCalled();
    // Give the microtask queue a tick to ensure no unhandled rejection
    await new Promise((r) => setTimeout(r, 10));
  });

  it('swallows async callback that throws', async () => {
    const cb = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(() => emitEvent(cb, sampleEvent)).not.toThrow();
    expect(cb).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 10));
  });
});
