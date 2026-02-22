export type {
  ConnectionInfo,
  Viewport,
  RawSignals,
  DeviceProfile,
  CpuTier,
  MemoryTier,
  ConnectionTier,
  DeviceTiers,
  RenderingHints,
  ClassifiedProfile,
} from './profile.js';

export type {
  CpuThresholds,
  MemoryThresholds,
  ConnectionThresholds,
  TierThresholds,
} from './thresholds.js';
export {
  DEFAULT_CPU_THRESHOLDS,
  DEFAULT_MEMORY_THRESHOLDS,
  DEFAULT_CONNECTION_THRESHOLDS,
} from './thresholds.js';

export { classify, classifyCpu, classifyMemory, classifyConnection } from './classify.js';
export { deriveHints } from './hints.js';
export { isValidSignals } from './validate.js';
