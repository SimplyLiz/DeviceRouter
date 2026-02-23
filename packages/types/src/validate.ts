import type { RawSignals } from './profile.js';
import type { TierThresholds } from './thresholds.js';
import {
  DEFAULT_CPU_THRESHOLDS,
  DEFAULT_MEMORY_THRESHOLDS,
  DEFAULT_CONNECTION_THRESHOLDS,
} from './thresholds.js';

export function validateThresholds(thresholds: TierThresholds): void {
  const errors: string[] = [];

  if (thresholds.cpu) {
    const cpu = { ...DEFAULT_CPU_THRESHOLDS, ...thresholds.cpu };
    if (cpu.lowUpperBound <= 0) errors.push('cpu.lowUpperBound must be positive');
    if (cpu.midUpperBound <= 0) errors.push('cpu.midUpperBound must be positive');
    if (cpu.lowUpperBound >= cpu.midUpperBound)
      errors.push(
        `cpu.lowUpperBound (${cpu.lowUpperBound}) must be less than cpu.midUpperBound (${cpu.midUpperBound})`,
      );
  }

  if (thresholds.memory) {
    const mem = { ...DEFAULT_MEMORY_THRESHOLDS, ...thresholds.memory };
    if (mem.lowUpperBound <= 0) errors.push('memory.lowUpperBound must be positive');
    if (mem.midUpperBound <= 0) errors.push('memory.midUpperBound must be positive');
    if (mem.lowUpperBound >= mem.midUpperBound)
      errors.push(
        `memory.lowUpperBound (${mem.lowUpperBound}) must be less than memory.midUpperBound (${mem.midUpperBound})`,
      );
  }

  if (thresholds.connection) {
    const conn = { ...DEFAULT_CONNECTION_THRESHOLDS, ...thresholds.connection };
    if (conn.downlink2gUpperBound <= 0)
      errors.push('connection.downlink2gUpperBound must be positive');
    if (conn.downlink3gUpperBound <= 0)
      errors.push('connection.downlink3gUpperBound must be positive');
    if (conn.downlink4gUpperBound <= 0)
      errors.push('connection.downlink4gUpperBound must be positive');
    if (conn.downlink2gUpperBound >= conn.downlink3gUpperBound)
      errors.push(
        `connection.downlink2gUpperBound (${conn.downlink2gUpperBound}) must be less than connection.downlink3gUpperBound (${conn.downlink3gUpperBound})`,
      );
    if (conn.downlink3gUpperBound >= conn.downlink4gUpperBound)
      errors.push(
        `connection.downlink3gUpperBound (${conn.downlink3gUpperBound}) must be less than connection.downlink4gUpperBound (${conn.downlink4gUpperBound})`,
      );
  }

  if (thresholds.gpu) {
    if (
      thresholds.gpu.softwarePattern !== undefined &&
      !(thresholds.gpu.softwarePattern instanceof RegExp)
    )
      errors.push('gpu.softwarePattern must be a RegExp');
    if (
      thresholds.gpu.highEndPattern !== undefined &&
      !(thresholds.gpu.highEndPattern instanceof RegExp)
    )
      errors.push('gpu.highEndPattern must be a RegExp');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid thresholds:\n- ${errors.join('\n- ')}`);
  }
}

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
