export type {
  ConnectionInfo,
  Viewport,
  RawSignals,
  StoredSignals,
  DeviceProfile,
  CpuTier,
  MemoryTier,
  ConnectionTier,
  GpuTier,
  DeviceTiers,
  RenderingHints,
  ClassifiedProfile,
  ProfileSource,
  FallbackProfile,
} from './profile.js';

export type {
  CpuThresholds,
  MemoryThresholds,
  ConnectionThresholds,
  GpuThresholds,
  TierThresholds,
} from './thresholds.js';
export {
  DEFAULT_CPU_THRESHOLDS,
  DEFAULT_MEMORY_THRESHOLDS,
  DEFAULT_CONNECTION_THRESHOLDS,
  DEFAULT_GPU_THRESHOLDS,
} from './thresholds.js';

export {
  classify,
  classifyCpu,
  classifyMemory,
  classifyConnection,
  classifyGpu,
  CONSERVATIVE_TIERS,
  OPTIMISTIC_TIERS,
} from './classify.js';
export { deriveHints } from './hints.js';
export { isValidSignals, validateThresholds } from './validate.js';
export { isBotSignals } from './bot.js';
export { classifyFromHeaders, resolveFallback, ACCEPT_CH_VALUE } from './headers.js';
export type { DeviceRouterEvent, OnEventCallback } from './events.js';
export { emitEvent } from './events.js';
export { createProbeHealthCheck, NO_PROBE_DATA_THRESHOLD } from './health.js';
