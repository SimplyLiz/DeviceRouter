import { describe, it, expect } from 'vitest';
import { deriveHints } from '../hints.js';

describe('deriveHints', () => {
  it('returns restrictive hints for low-end device', () => {
    const hints = deriveHints({ cpu: 'low', memory: 'low', connection: '2g', gpu: 'none' });
    expect(hints).toEqual({
      deferHeavyComponents: true,
      serveMinimalCSS: true,
      reduceAnimations: true,
      useImagePlaceholders: true,
      disableAutoplay: true,
      preferServerRendering: true,
      disable3dEffects: true,
    });
  });

  it('returns permissive hints for high-end device', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' });
    expect(hints).toEqual({
      deferHeavyComponents: false,
      serveMinimalCSS: false,
      reduceAnimations: false,
      useImagePlaceholders: false,
      disableAutoplay: false,
      preferServerRendering: false,
      disable3dEffects: false,
    });
  });

  it('respects prefersReducedMotion signal', () => {
    const hints = deriveHints(
      { cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' },
      { prefersReducedMotion: true },
    );
    expect(hints.reduceAnimations).toBe(true);
  });

  it('defers heavy components on slow connection with good hardware', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: '3g', gpu: 'high' });
    expect(hints.deferHeavyComponents).toBe(true);
    expect(hints.useImagePlaceholders).toBe(true);
    expect(hints.disableAutoplay).toBe(true);
    expect(hints.serveMinimalCSS).toBe(false);
    expect(hints.preferServerRendering).toBe(false);
  });

  it('serves minimal CSS for low CPU regardless of connection', () => {
    const hints = deriveHints({ cpu: 'low', memory: 'high', connection: 'high', gpu: 'high' });
    expect(hints.serveMinimalCSS).toBe(true);
    expect(hints.preferServerRendering).toBe(true);
  });

  it('disables 3d effects for no GPU', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'none' });
    expect(hints.disable3dEffects).toBe(true);
  });

  it('disables 3d effects for low GPU', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'low' });
    expect(hints.disable3dEffects).toBe(true);
  });

  it('enables 3d effects for mid GPU', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'mid' });
    expect(hints.disable3dEffects).toBe(false);
  });

  it('enables 3d effects for high GPU', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' });
    expect(hints.disable3dEffects).toBe(false);
  });

  it('constrains hints on low battery unplugged even for high-end device', () => {
    const hints = deriveHints(
      { cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' },
      { battery: { level: 0.08, charging: false } },
    );
    expect(hints.deferHeavyComponents).toBe(true);
    expect(hints.reduceAnimations).toBe(true);
    expect(hints.disableAutoplay).toBe(true);
    // Capability-based hints stay permissive
    expect(hints.serveMinimalCSS).toBe(false);
    expect(hints.useImagePlaceholders).toBe(false);
    expect(hints.preferServerRendering).toBe(false);
    expect(hints.disable3dEffects).toBe(false);
  });

  it('does not constrain when low battery but charging', () => {
    const hints = deriveHints(
      { cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' },
      { battery: { level: 0.05, charging: true } },
    );
    expect(hints.deferHeavyComponents).toBe(false);
    expect(hints.reduceAnimations).toBe(false);
    expect(hints.disableAutoplay).toBe(false);
  });

  it('does not constrain when battery above threshold', () => {
    const hints = deriveHints(
      { cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' },
      { battery: { level: 0.5, charging: false } },
    );
    expect(hints.deferHeavyComponents).toBe(false);
    expect(hints.reduceAnimations).toBe(false);
    expect(hints.disableAutoplay).toBe(false);
  });

  it('does not change behavior when battery signal is absent', () => {
    const hints = deriveHints({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' }, {});
    expect(hints.deferHeavyComponents).toBe(false);
    expect(hints.reduceAnimations).toBe(false);
    expect(hints.disableAutoplay).toBe(false);
  });

  it('does not constrain at exactly 0.15 (strict less-than)', () => {
    const hints = deriveHints(
      { cpu: 'high', memory: 'high', connection: 'high', gpu: 'high' },
      { battery: { level: 0.15, charging: false } },
    );
    expect(hints.deferHeavyComponents).toBe(false);
    expect(hints.reduceAnimations).toBe(false);
    expect(hints.disableAutoplay).toBe(false);
  });
});
