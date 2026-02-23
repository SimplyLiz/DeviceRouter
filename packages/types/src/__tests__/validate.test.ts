import { describe, it, expect } from 'vitest';
import { isValidSignals, validateThresholds } from '../validate.js';

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
