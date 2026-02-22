import type { RawSignals } from './profile.js';

export function isValidSignals(body: unknown): body is RawSignals {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.hardwareConcurrency !== undefined && typeof b.hardwareConcurrency !== 'number')
    return false;
  if (b.deviceMemory !== undefined && typeof b.deviceMemory !== 'number') return false;
  if (b.userAgent !== undefined && typeof b.userAgent !== 'string') return false;
  if (b.pixelRatio !== undefined && typeof b.pixelRatio !== 'number') return false;
  if (b.prefersReducedMotion !== undefined && typeof b.prefersReducedMotion !== 'boolean')
    return false;
  if (
    b.prefersColorScheme !== undefined &&
    b.prefersColorScheme !== 'light' &&
    b.prefersColorScheme !== 'dark' &&
    b.prefersColorScheme !== 'no-preference'
  )
    return false;
  if (b.gpuRenderer !== undefined && typeof b.gpuRenderer !== 'string') return false;
  if (b.battery !== undefined) {
    if (typeof b.battery !== 'object' || b.battery === null) return false;
    const bat = b.battery as Record<string, unknown>;
    if (typeof bat.level !== 'number') return false;
    if (typeof bat.charging !== 'boolean') return false;
  }
  return true;
}
