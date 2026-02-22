import { describe, it, expect } from 'vitest';
import { classify, classifyCpu, classifyMemory, classifyConnection } from '../classify.js';

describe('classifyCpu', () => {
  it('returns low for undefined', () => {
    expect(classifyCpu(undefined)).toBe('low');
  });

  it('returns low for 1-2 cores', () => {
    expect(classifyCpu(1)).toBe('low');
    expect(classifyCpu(2)).toBe('low');
  });

  it('returns mid for 3-4 cores', () => {
    expect(classifyCpu(3)).toBe('mid');
    expect(classifyCpu(4)).toBe('mid');
  });

  it('returns high for 5+ cores', () => {
    expect(classifyCpu(5)).toBe('high');
    expect(classifyCpu(8)).toBe('high');
    expect(classifyCpu(16)).toBe('high');
  });
});

describe('classifyMemory', () => {
  it('returns low for undefined', () => {
    expect(classifyMemory(undefined)).toBe('low');
  });

  it('returns low for <=2 GB', () => {
    expect(classifyMemory(1)).toBe('low');
    expect(classifyMemory(2)).toBe('low');
  });

  it('returns mid for 2-4 GB', () => {
    expect(classifyMemory(3)).toBe('mid');
    expect(classifyMemory(4)).toBe('mid');
  });

  it('returns high for >4 GB', () => {
    expect(classifyMemory(8)).toBe('high');
    expect(classifyMemory(16)).toBe('high');
  });
});

describe('classifyConnection', () => {
  it('returns 4g for no info', () => {
    expect(classifyConnection(undefined, undefined)).toBe('4g');
  });

  it('returns 2g for slow-2g or 2g', () => {
    expect(classifyConnection('slow-2g')).toBe('2g');
    expect(classifyConnection('2g')).toBe('2g');
  });

  it('returns 3g for 3g', () => {
    expect(classifyConnection('3g')).toBe('3g');
  });

  it('returns 4g for 4g with low downlink', () => {
    expect(classifyConnection('4g', 3)).toBe('4g');
  });

  it('returns fast for 4g with high downlink', () => {
    expect(classifyConnection('4g', 10)).toBe('fast');
  });

  it('classifies by downlink alone when no effectiveType', () => {
    expect(classifyConnection(undefined, 0.3)).toBe('2g');
    expect(classifyConnection(undefined, 1)).toBe('3g');
    expect(classifyConnection(undefined, 3)).toBe('4g');
    expect(classifyConnection(undefined, 10)).toBe('fast');
  });
});

describe('classify', () => {
  it('classifies a low-end device', () => {
    const result = classify({
      hardwareConcurrency: 2,
      deviceMemory: 1,
      connection: { effectiveType: '2g' },
    });
    expect(result).toEqual({ cpu: 'low', memory: 'low', connection: '2g' });
  });

  it('classifies a high-end device', () => {
    const result = classify({
      hardwareConcurrency: 8,
      deviceMemory: 8,
      connection: { effectiveType: '4g', downlink: 50 },
    });
    expect(result).toEqual({ cpu: 'high', memory: 'high', connection: 'fast' });
  });

  it('classifies with missing signals', () => {
    const result = classify({});
    expect(result).toEqual({ cpu: 'low', memory: 'low', connection: '4g' });
  });
});
