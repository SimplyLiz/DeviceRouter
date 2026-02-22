export interface ConnectionInfo {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface RawSignals {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: ConnectionInfo;
  userAgent?: string;
  viewport?: Viewport;
  pixelRatio?: number;
  prefersReducedMotion?: boolean;
  prefersColorScheme?: 'light' | 'dark' | 'no-preference';
  gpuRenderer?: string;
}

export interface DeviceProfile {
  schemaVersion: 1;
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
  signals: RawSignals;
}

export type CpuTier = 'low' | 'mid' | 'high';
export type MemoryTier = 'low' | 'mid' | 'high';
export type ConnectionTier = '2g' | '3g' | '4g' | 'fast';
export type GpuTier = 'none' | 'low' | 'mid' | 'high';

export interface DeviceTiers {
  cpu: CpuTier;
  memory: MemoryTier;
  connection: ConnectionTier;
  gpu: GpuTier;
}

export interface RenderingHints {
  deferHeavyComponents: boolean;
  serveMinimalCSS: boolean;
  reduceAnimations: boolean;
  useImagePlaceholders: boolean;
  disableAutoplay: boolean;
  preferServerRendering: boolean;
  disable3dEffects: boolean;
}

export interface ClassifiedProfile {
  profile: DeviceProfile;
  tiers: DeviceTiers;
  hints: RenderingHints;
}
