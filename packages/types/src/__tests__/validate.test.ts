import { describe, it, expect } from 'vitest';
import { isValidSignals } from '../validate.js';

describe('isValidSignals', () => {
  it('accepts valid signals with battery', () => {
    expect(isValidSignals({ battery: { level: 0.5, charging: true } })).toBe(true);
  });

  it('accepts signals without battery', () => {
    expect(isValidSignals({ hardwareConcurrency: 4 })).toBe(true);
  });

  it('rejects non-object battery', () => {
    expect(isValidSignals({ battery: 'full' })).toBe(false);
  });

  it('rejects null battery', () => {
    expect(isValidSignals({ battery: null })).toBe(false);
  });

  it('rejects non-number level', () => {
    expect(isValidSignals({ battery: { level: '0.5', charging: true } })).toBe(false);
  });

  it('rejects non-boolean charging', () => {
    expect(isValidSignals({ battery: { level: 0.5, charging: 'yes' } })).toBe(false);
  });
});
