import { describe, it, expect } from 'vitest';
import { deriveHints } from '../hints.js';

describe('deriveHints', () => {
  it('returns restrictive hints for low-end device', () => {
    const hints = deriveHints({ cpu: 'low', memory: 'low', connection: '2g' });
    expect(hints).toEqual({
      deferHeavyComponents: true,
      serveMinimalCSS: true,
      reduceAnimations: true,
      useImagePlaceholders: true,
      disableAutoplay: true,
      preferServerRendering: true,
    });
  });

  it('returns permissive hints for high-end device', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'fast' });
    expect(hints).toEqual({
      deferHeavyComponents: false,
      serveMinimalCSS: false,
      reduceAnimations: false,
      useImagePlaceholders: false,
      disableAutoplay: false,
      preferServerRendering: false,
    });
  });

  it('respects prefersReducedMotion signal', () => {
    const hints = deriveHints(
      { cpu: 'high', memory: 'high', connection: 'fast' },
      { prefersReducedMotion: true },
    );
    expect(hints.reduceAnimations).toBe(true);
  });

  it('defers heavy components on slow connection with good hardware', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: '3g' });
    expect(hints.deferHeavyComponents).toBe(true);
    expect(hints.useImagePlaceholders).toBe(true);
    expect(hints.disableAutoplay).toBe(true);
    expect(hints.serveMinimalCSS).toBe(false);
    expect(hints.preferServerRendering).toBe(false);
  });

  it('serves minimal CSS for low CPU regardless of connection', () => {
    const hints = deriveHints({ cpu: 'low', memory: 'high', connection: 'fast' });
    expect(hints.serveMinimalCSS).toBe(true);
    expect(hints.preferServerRendering).toBe(true);
  });
});
