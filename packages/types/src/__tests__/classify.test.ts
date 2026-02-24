import { describe, it, expect } from 'vitest';
import {
  classify,
  classifyCpu,
  classifyMemory,
  classifyConnection,
  classifyGpu,
} from '../classify.js';

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

  it('uses custom thresholds', () => {
    expect(classifyCpu(4, { lowUpperBound: 4 })).toBe('low');
    expect(classifyCpu(6, { lowUpperBound: 4, midUpperBound: 8 })).toBe('mid');
    expect(classifyCpu(10, { midUpperBound: 8 })).toBe('high');
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

  it('uses custom thresholds', () => {
    expect(classifyMemory(4, { lowUpperBound: 4 })).toBe('low');
    expect(classifyMemory(6, { lowUpperBound: 4, midUpperBound: 8 })).toBe('mid');
    expect(classifyMemory(10, { midUpperBound: 8 })).toBe('high');
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
    expect(classifyConnection('4g', 10)).toBe('high');
  });

  it('classifies by downlink alone when no effectiveType', () => {
    expect(classifyConnection(undefined, 0.3)).toBe('2g');
    expect(classifyConnection(undefined, 1)).toBe('3g');
    expect(classifyConnection(undefined, 3)).toBe('4g');
    expect(classifyConnection(undefined, 10)).toBe('high');
  });

  it('uses custom downlink thresholds', () => {
    // With wider 2g band (up to 1 Mbps)
    expect(classifyConnection(undefined, 0.8, { lowUpperBound: 1 })).toBe('2g');
    // Default would classify 0.8 as 3g, custom keeps it as 2g
    expect(classifyConnection(undefined, 0.8)).toBe('3g');

    // Custom 4g upper bound
    expect(classifyConnection(undefined, 8, { highUpperBound: 10 })).toBe('4g');
    expect(classifyConnection(undefined, 8)).toBe('high');
  });

  it('effectiveType string matches are not affected by thresholds', () => {
    expect(classifyConnection('2g', undefined, { lowUpperBound: 0.1 })).toBe('2g');
    expect(classifyConnection('3g', undefined, { midUpperBound: 0.1 })).toBe('3g');
  });
});

describe('classifyGpu', () => {
  it('returns none for undefined', () => {
    expect(classifyGpu(undefined)).toBe('none');
  });

  it('returns none for empty string', () => {
    expect(classifyGpu('')).toBe('none');
  });

  it('returns low for software renderers', () => {
    expect(classifyGpu('Google SwiftShader')).toBe('low');
    expect(classifyGpu('llvmpipe (LLVM 12.0.0, 256 bits)')).toBe('low');
    expect(classifyGpu('Software Rasterizer')).toBe('low');
  });

  it('returns high for high-end GPUs', () => {
    expect(classifyGpu('NVIDIA GeForce RTX 3080')).toBe('high');
    expect(classifyGpu('NVIDIA GeForce RTX 4090')).toBe('high');
    expect(classifyGpu('AMD Radeon RX 6800 XT')).toBe('high');
    expect(classifyGpu('AMD Radeon RX 7900 XTX')).toBe('high');
    expect(classifyGpu('AMD Radeon Pro W6800')).toBe('high');
    expect(classifyGpu('Apple M1')).toBe('high');
    expect(classifyGpu('Apple M2 Pro')).toBe('high');
    expect(classifyGpu('Apple M3 Max')).toBe('high');
  });

  it('returns mid for other GPUs', () => {
    expect(classifyGpu('Intel(R) HD Graphics 630')).toBe('mid');
    expect(classifyGpu('NVIDIA GeForce GTX 1060')).toBe('mid');
    expect(classifyGpu('AMD Radeon RX 580')).toBe('mid');
    expect(classifyGpu('Mali-G78')).toBe('mid');
    expect(classifyGpu('Adreno (TM) 660')).toBe('mid');
  });

  it('uses custom softwarePattern threshold', () => {
    // Default: Intel HD not software
    expect(classifyGpu('Intel(R) HD Graphics 630')).toBe('mid');
    // Custom: treat Intel HD as software
    expect(
      classifyGpu('Intel(R) HD Graphics 630', {
        softwarePattern: /Intel.*HD/i,
      }),
    ).toBe('low');
  });

  it('uses custom highEndPattern threshold', () => {
    // Default: GTX 1060 is mid
    expect(classifyGpu('NVIDIA GeForce GTX 1060')).toBe('mid');
    // Custom: treat GTX as high-end
    expect(
      classifyGpu('NVIDIA GeForce GTX 1060', {
        highEndPattern: /\bGTX\b/i,
      }),
    ).toBe('high');
  });
});

describe('classify', () => {
  it('classifies a low-end device', () => {
    const result = classify({
      hardwareConcurrency: 2,
      deviceMemory: 1,
      connection: { effectiveType: '2g' },
    });
    expect(result).toEqual({ cpu: 'low', memory: 'low', connection: '2g', gpu: 'none' });
  });

  it('classifies a high-end device', () => {
    const result = classify({
      hardwareConcurrency: 8,
      deviceMemory: 8,
      connection: { effectiveType: '4g', downlink: 50 },
    });
    expect(result).toEqual({ cpu: 'high', memory: 'high', connection: 'high', gpu: 'none' });
  });

  it('classifies with missing signals', () => {
    const result = classify({});
    expect(result).toEqual({ cpu: 'low', memory: 'low', connection: '4g', gpu: 'none' });
  });

  it('classifies GPU from gpuRenderer signal', () => {
    const result = classify({
      hardwareConcurrency: 8,
      deviceMemory: 8,
      gpuRenderer: 'NVIDIA GeForce RTX 3080',
    });
    expect(result.gpu).toBe('high');
  });

  it('applies custom thresholds across all dimensions', () => {
    const result = classify(
      { hardwareConcurrency: 4, deviceMemory: 4, connection: { downlink: 3 } },
      {
        cpu: { lowUpperBound: 4 },
        memory: { lowUpperBound: 4 },
        connection: { highUpperBound: 3 },
      },
    );
    expect(result).toEqual({ cpu: 'low', memory: 'low', connection: 'high', gpu: 'none' });
  });

  it('applies custom GPU thresholds', () => {
    const result = classify(
      { hardwareConcurrency: 8, gpuRenderer: 'NVIDIA GeForce GTX 1060' },
      { gpu: { highEndPattern: /\bGTX\b/i } },
    );
    expect(result.gpu).toBe('high');
  });

  it('partial thresholds leave other dimensions at defaults', () => {
    const result = classify(
      { hardwareConcurrency: 4, deviceMemory: 4 },
      { cpu: { lowUpperBound: 6 } },
    );
    expect(result.cpu).toBe('low'); // custom: 4 <= 6
    expect(result.memory).toBe('mid'); // default: 4 <= 4
  });
});
