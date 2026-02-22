import type { DeviceTiers, RenderingHints, RawSignals } from './profile.js';

export function deriveHints(tiers: DeviceTiers, signals?: RawSignals): RenderingHints {
  const isLowEnd = tiers.cpu === 'low' || tiers.memory === 'low';
  const isSlowConnection = tiers.connection === '2g' || tiers.connection === '3g';
  const isBatteryConstrained =
    signals?.battery != null && !signals.battery.charging && signals.battery.level < 0.15;

  return {
    deferHeavyComponents: isLowEnd || isSlowConnection || isBatteryConstrained,
    serveMinimalCSS: isLowEnd,
    reduceAnimations: isLowEnd || signals?.prefersReducedMotion === true || isBatteryConstrained,
    useImagePlaceholders: isSlowConnection,
    disableAutoplay: isLowEnd || isSlowConnection || isBatteryConstrained,
    preferServerRendering: isLowEnd,
    disable3dEffects: tiers.gpu === 'none' || tiers.gpu === 'low',
  };
}
