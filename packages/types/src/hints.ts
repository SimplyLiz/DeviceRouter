import type { DeviceTiers, RenderingHints, RawSignals } from './profile.js';

export function deriveHints(tiers: DeviceTiers, signals?: RawSignals): RenderingHints {
  const isLowEnd = tiers.cpu === 'low' || tiers.memory === 'low';
  const isSlowConnection = tiers.connection === '2g' || tiers.connection === '3g';

  return {
    deferHeavyComponents: isLowEnd || isSlowConnection,
    serveMinimalCSS: isLowEnd,
    reduceAnimations: isLowEnd || signals?.prefersReducedMotion === true,
    useImagePlaceholders: isSlowConnection,
    disableAutoplay: isLowEnd || isSlowConnection,
    preferServerRendering: isLowEnd,
    disable3dEffects: tiers.gpu === 'none' || tiers.gpu === 'low',
  };
}
