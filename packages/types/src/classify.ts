import type {
  RawSignals,
  CpuTier,
  MemoryTier,
  ConnectionTier,
  GpuTier,
  DeviceTiers,
} from './profile.js';
import type { TierThresholds } from './thresholds.js';
import {
  DEFAULT_CPU_THRESHOLDS,
  DEFAULT_MEMORY_THRESHOLDS,
  DEFAULT_CONNECTION_THRESHOLDS,
  DEFAULT_GPU_THRESHOLDS,
} from './thresholds.js';

export function classifyCpu(
  hardwareConcurrency?: number,
  thresholds?: Partial<import('./thresholds.js').CpuThresholds>,
): CpuTier {
  const { lowUpperBound, midUpperBound } = { ...DEFAULT_CPU_THRESHOLDS, ...thresholds };
  if (hardwareConcurrency == null || hardwareConcurrency <= lowUpperBound) return 'low';
  if (hardwareConcurrency <= midUpperBound) return 'mid';
  return 'high';
}

export function classifyMemory(
  deviceMemory?: number,
  thresholds?: Partial<import('./thresholds.js').MemoryThresholds>,
): MemoryTier {
  const { lowUpperBound, midUpperBound } = { ...DEFAULT_MEMORY_THRESHOLDS, ...thresholds };
  if (deviceMemory == null || deviceMemory <= lowUpperBound) return 'low';
  if (deviceMemory <= midUpperBound) return 'mid';
  return 'high';
}

export function classifyConnection(
  effectiveType?: string,
  downlink?: number,
  thresholds?: Partial<import('./thresholds.js').ConnectionThresholds>,
): ConnectionTier {
  const { downlink2gUpperBound, downlink3gUpperBound, downlink4gUpperBound } = {
    ...DEFAULT_CONNECTION_THRESHOLDS,
    ...thresholds,
  };

  if (effectiveType === 'slow-2g' || effectiveType === '2g') return '2g';
  if (effectiveType === '3g') return '3g';
  if (effectiveType === '4g' && downlink != null && downlink < downlink4gUpperBound) return '4g';
  if (effectiveType === '4g') return 'fast';
  if (downlink != null) {
    if (downlink < downlink2gUpperBound) return '2g';
    if (downlink < downlink3gUpperBound) return '3g';
    if (downlink < downlink4gUpperBound) return '4g';
    return 'fast';
  }
  return '4g';
}

export function classifyGpu(
  renderer?: string,
  thresholds?: Partial<import('./thresholds.js').GpuThresholds>,
): GpuTier {
  if (!renderer) return 'none';
  const { softwarePattern, highEndPattern } = { ...DEFAULT_GPU_THRESHOLDS, ...thresholds };
  if (softwarePattern.test(renderer)) return 'low';
  if (highEndPattern.test(renderer)) return 'high';
  return 'mid';
}

export function classify(signals: RawSignals, thresholds?: TierThresholds): DeviceTiers {
  return {
    cpu: classifyCpu(signals.hardwareConcurrency, thresholds?.cpu),
    memory: classifyMemory(signals.deviceMemory, thresholds?.memory),
    connection: classifyConnection(
      signals.connection?.effectiveType,
      signals.connection?.downlink,
      thresholds?.connection,
    ),
    gpu: classifyGpu(signals.gpuRenderer, thresholds?.gpu),
  };
}

export const CONSERVATIVE_TIERS: DeviceTiers = {
  cpu: 'low',
  memory: 'low',
  connection: '3g',
  gpu: 'low',
};

export const OPTIMISTIC_TIERS: DeviceTiers = {
  cpu: 'high',
  memory: 'high',
  connection: 'fast',
  gpu: 'mid',
};
