export interface ProbeSignals {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  userAgent?: string;
  viewport?: { width: number; height: number };
  pixelRatio?: number;
  prefersReducedMotion?: boolean;
  prefersColorScheme?: 'light' | 'dark' | 'no-preference';
  gpuRenderer?: string;
}

export function collectHardwareConcurrency(): number | undefined {
  return typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
}

export function collectDeviceMemory(): number | undefined {
  return typeof navigator !== 'undefined'
    ? (navigator as { deviceMemory?: number }).deviceMemory
    : undefined;
}

export function collectConnection():
  | { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
  | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const conn = (navigator as { connection?: Record<string, unknown> }).connection;
  if (!conn) return undefined;
  return {
    effectiveType: conn.effectiveType as string | undefined,
    downlink: conn.downlink as number | undefined,
    rtt: conn.rtt as number | undefined,
    saveData: conn.saveData as boolean | undefined,
  };
}

export function collectUserAgent(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
}

export function collectViewport(): { width: number; height: number } | undefined {
  if (typeof window === 'undefined') return undefined;
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function collectPixelRatio(): number | undefined {
  return typeof window !== 'undefined' ? window.devicePixelRatio : undefined;
}

export function collectPrefersReducedMotion(): boolean | undefined {
  if (typeof window === 'undefined' || !window.matchMedia) return undefined;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function collectPrefersColorScheme(): 'light' | 'dark' | 'no-preference' | undefined {
  if (typeof window === 'undefined' || !window.matchMedia) return undefined;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'no-preference';
}

export function collectGpuRenderer(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('webgl2');
    if (!gl) return undefined;
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    if (!d) return undefined;
    return gl.getParameter(d.UNMASKED_RENDERER_WEBGL) as string;
  } catch {
    return undefined;
  }
}

export function collectSignals(): ProbeSignals {
  return {
    hardwareConcurrency: collectHardwareConcurrency(),
    deviceMemory: collectDeviceMemory(),
    connection: collectConnection(),
    userAgent: collectUserAgent(),
    viewport: collectViewport(),
    pixelRatio: collectPixelRatio(),
    prefersReducedMotion: collectPrefersReducedMotion(),
    prefersColorScheme: collectPrefersColorScheme(),
    gpuRenderer: collectGpuRenderer(),
  };
}
