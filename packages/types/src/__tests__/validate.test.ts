import { describe, it, expect } from 'vitest';
import { isValidSignals, validateThresholds } from '../validate.js';

describe('isValidSignals', () => {
  it('accepts empty object', () => {
    expect(isValidSignals({})).toBe(true);
  });

  it('accepts full valid payload', () => {
    expect(
      isValidSignals({
        hardwareConcurrency: 8,
        deviceMemory: 4,
        userAgent: 'Mozilla/5.0',
        pixelRatio: 2,
        prefersReducedMotion: false,
        prefersColorScheme: 'dark',
        gpuRenderer: 'ANGLE (Apple, M1)',
        viewport: { width: 1920, height: 1080 },
        battery: { level: 0.85, charging: true },
        connection: { effectiveType: '4g', downlink: 10, rtt: 50 },
      }),
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidSignals(null)).toBe(false);
  });

  it('rejects non-object types', () => {
    expect(isValidSignals('string')).toBe(false);
    expect(isValidSignals(42)).toBe(false);
    expect(isValidSignals(true)).toBe(false);
    expect(isValidSignals(undefined)).toBe(false);
  });

  it('rejects non-number hardwareConcurrency', () => {
    expect(isValidSignals({ hardwareConcurrency: '4' })).toBe(false);
  });

  it('accepts undefined hardwareConcurrency', () => {
    expect(isValidSignals({ hardwareConcurrency: undefined })).toBe(true);
  });

  it('rejects non-number deviceMemory', () => {
    expect(isValidSignals({ deviceMemory: '4' })).toBe(false);
  });

  it('rejects non-string userAgent', () => {
    expect(isValidSignals({ userAgent: 123 })).toBe(false);
  });

  it('rejects non-number pixelRatio', () => {
    expect(isValidSignals({ pixelRatio: '2' })).toBe(false);
  });

  it('rejects non-boolean prefersReducedMotion', () => {
    expect(isValidSignals({ prefersReducedMotion: 'yes' })).toBe(false);
  });

  it('rejects invalid prefersColorScheme', () => {
    expect(isValidSignals({ prefersColorScheme: 'blue' })).toBe(false);
  });

  it('accepts valid prefersColorScheme values', () => {
    expect(isValidSignals({ prefersColorScheme: 'light' })).toBe(true);
    expect(isValidSignals({ prefersColorScheme: 'dark' })).toBe(true);
    expect(isValidSignals({ prefersColorScheme: 'no-preference' })).toBe(true);
  });

  it('rejects non-string gpuRenderer', () => {
    expect(isValidSignals({ gpuRenderer: 42 })).toBe(false);
  });

  it('accepts valid signals with battery', () => {
    expect(isValidSignals({ battery: { level: 0.5, charging: true } })).toBe(true);
  });

  it('rejects non-object battery', () => {
    expect(isValidSignals({ battery: 'full' })).toBe(false);
  });

  it('rejects null battery', () => {
    expect(isValidSignals({ battery: null })).toBe(false);
  });

  it('rejects non-number battery level', () => {
    expect(isValidSignals({ battery: { level: '0.5', charging: true } })).toBe(false);
  });

  it('rejects non-boolean battery charging', () => {
    expect(isValidSignals({ battery: { level: 0.5, charging: 'yes' } })).toBe(false);
  });
});

describe('validateThresholds', () => {
  it('accepts valid thresholds', () => {
    expect(() =>
      validateThresholds({
        cpu: { lowUpperBound: 2, midUpperBound: 4 },
        memory: { lowUpperBound: 2, midUpperBound: 8 },
        connection: { downlink2gUpperBound: 0.5, downlink3gUpperBound: 2, downlink4gUpperBound: 5 },
        gpu: { softwarePattern: /SwiftShader/i, highEndPattern: /RTX/i },
      }),
    ).not.toThrow();
  });

  it('accepts empty thresholds (all defaults)', () => {
    expect(() => validateThresholds({})).not.toThrow();
  });

  it('accepts partial cpu thresholds that stay ordered after merge', () => {
    expect(() => validateThresholds({ cpu: { midUpperBound: 8 } })).not.toThrow();
  });

  it('throws on inverted cpu bounds', () => {
    expect(() => validateThresholds({ cpu: { lowUpperBound: 10, midUpperBound: 2 } })).toThrow(
      /cpu\.lowUpperBound \(10\) must be less than cpu\.midUpperBound \(2\)/,
    );
  });

  it('throws on equal cpu bounds', () => {
    expect(() => validateThresholds({ cpu: { lowUpperBound: 4, midUpperBound: 4 } })).toThrow(
      /cpu\.lowUpperBound \(4\) must be less than cpu\.midUpperBound \(4\)/,
    );
  });

  it('throws when partial cpu midUpperBound is below default lowUpperBound', () => {
    // default lowUpperBound is 2, so midUpperBound: 1 is inverted after merge
    expect(() => validateThresholds({ cpu: { midUpperBound: 1 } })).toThrow(
      /cpu\.lowUpperBound \(2\) must be less than cpu\.midUpperBound \(1\)/,
    );
  });

  it('throws on inverted memory bounds', () => {
    expect(() => validateThresholds({ memory: { lowUpperBound: 8, midUpperBound: 2 } })).toThrow(
      /memory\.lowUpperBound \(8\) must be less than memory\.midUpperBound \(2\)/,
    );
  });

  it('throws on inverted connection bounds (2g >= 3g)', () => {
    expect(() =>
      validateThresholds({ connection: { downlink2gUpperBound: 5, downlink3gUpperBound: 2 } }),
    ).toThrow(
      /connection\.downlink2gUpperBound \(5\) must be less than connection\.downlink3gUpperBound \(2\)/,
    );
  });

  it('throws on inverted connection bounds (3g >= 4g)', () => {
    expect(() =>
      validateThresholds({ connection: { downlink3gUpperBound: 10, downlink4gUpperBound: 5 } }),
    ).toThrow(
      /connection\.downlink3gUpperBound \(10\) must be less than connection\.downlink4gUpperBound \(5\)/,
    );
  });

  it('throws on negative cpu threshold', () => {
    expect(() => validateThresholds({ cpu: { lowUpperBound: -1 } })).toThrow(
      /cpu\.lowUpperBound must be positive/,
    );
  });

  it('throws on zero memory threshold', () => {
    expect(() => validateThresholds({ memory: { midUpperBound: 0 } })).toThrow(
      /memory\.midUpperBound must be positive/,
    );
  });

  it('throws on negative connection threshold', () => {
    expect(() => validateThresholds({ connection: { downlink2gUpperBound: -0.5 } })).toThrow(
      /connection\.downlink2gUpperBound must be positive/,
    );
  });

  it('throws on non-RegExp softwarePattern', () => {
    expect(() =>
      validateThresholds({ gpu: { softwarePattern: 'SwiftShader' as unknown as RegExp } }),
    ).toThrow(/gpu\.softwarePattern must be a RegExp/);
  });

  it('throws on non-RegExp highEndPattern', () => {
    expect(() =>
      validateThresholds({ gpu: { highEndPattern: 'RTX' as unknown as RegExp } }),
    ).toThrow(/gpu\.highEndPattern must be a RegExp/);
  });

  it('collects multiple errors', () => {
    expect(() =>
      validateThresholds({
        cpu: { lowUpperBound: -1, midUpperBound: -2 },
      }),
    ).toThrow(/cpu\.lowUpperBound must be positive[\s\S]*cpu\.midUpperBound must be positive/);
  });
});
