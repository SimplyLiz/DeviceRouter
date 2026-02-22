import type { RawSignals, CpuTier, MemoryTier, ConnectionTier, DeviceTiers } from './profile.js';

export function classifyCpu(hardwareConcurrency?: number): CpuTier {
  if (hardwareConcurrency == null || hardwareConcurrency <= 2) return 'low';
  if (hardwareConcurrency <= 4) return 'mid';
  return 'high';
}

export function classifyMemory(deviceMemory?: number): MemoryTier {
  if (deviceMemory == null || deviceMemory <= 2) return 'low';
  if (deviceMemory <= 4) return 'mid';
  return 'high';
}

export function classifyConnection(
  effectiveType?: string,
  downlink?: number,
): ConnectionTier {
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return '2g';
  if (effectiveType === '3g') return '3g';
  if (effectiveType === '4g' && downlink != null && downlink < 5) return '4g';
  if (effectiveType === '4g') return 'fast';
  if (downlink != null) {
    if (downlink < 0.5) return '2g';
    if (downlink < 2) return '3g';
    if (downlink < 5) return '4g';
    return 'fast';
  }
  return '4g';
}

export function classify(signals: RawSignals): DeviceTiers {
  return {
    cpu: classifyCpu(signals.hardwareConcurrency),
    memory: classifyMemory(signals.deviceMemory),
    connection: classifyConnection(
      signals.connection?.effectiveType,
      signals.connection?.downlink,
    ),
  };
}
