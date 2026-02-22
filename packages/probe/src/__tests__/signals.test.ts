import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  collectHardwareConcurrency,
  collectDeviceMemory,
  collectConnection,
  collectUserAgent,
  collectViewport,
  collectPixelRatio,
  collectPrefersReducedMotion,
  collectPrefersColorScheme,
  collectGpuRenderer,
  collectSignals,
} from '../signals.js';

describe('signal collectors', () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe('collectHardwareConcurrency', () => {
    it('returns hardwareConcurrency from navigator', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { hardwareConcurrency: 8 },
        writable: true,
        configurable: true,
      });
      expect(collectHardwareConcurrency()).toBe(8);
    });

    it('returns undefined when navigator is unavailable', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(collectHardwareConcurrency()).toBeUndefined();
    });
  });

  describe('collectDeviceMemory', () => {
    it('returns deviceMemory when available', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { deviceMemory: 4 },
        writable: true,
        configurable: true,
      });
      expect(collectDeviceMemory()).toBe(4);
    });

    it('returns undefined when deviceMemory is not exposed', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(collectDeviceMemory()).toBeUndefined();
    });
  });

  describe('collectConnection', () => {
    it('returns connection info when available', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
        },
        writable: true,
        configurable: true,
      });
      expect(collectConnection()).toEqual({
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      });
    });

    it('returns undefined when connection API is unavailable', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });
      expect(collectConnection()).toBeUndefined();
    });
  });

  describe('collectUserAgent', () => {
    it('returns user agent string', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { userAgent: 'TestBrowser/1.0' },
        writable: true,
        configurable: true,
      });
      expect(collectUserAgent()).toBe('TestBrowser/1.0');
    });
  });

  describe('collectViewport', () => {
    it('returns viewport dimensions', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { innerWidth: 1920, innerHeight: 1080, matchMedia: vi.fn() },
        writable: true,
        configurable: true,
      });
      expect(collectViewport()).toEqual({ width: 1920, height: 1080 });
    });

    it('returns undefined when window is unavailable', () => {
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(collectViewport()).toBeUndefined();
    });
  });

  describe('collectPixelRatio', () => {
    it('returns device pixel ratio', () => {
      Object.defineProperty(globalThis, 'window', {
        value: { devicePixelRatio: 2 },
        writable: true,
        configurable: true,
      });
      expect(collectPixelRatio()).toBe(2);
    });
  });

  describe('collectPrefersReducedMotion', () => {
    it('returns true when user prefers reduced motion', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: vi.fn((query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
          })),
        },
        writable: true,
        configurable: true,
      });
      expect(collectPrefersReducedMotion()).toBe(true);
    });

    it('returns false when user does not prefer reduced motion', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: vi.fn(() => ({ matches: false })),
        },
        writable: true,
        configurable: true,
      });
      expect(collectPrefersReducedMotion()).toBe(false);
    });
  });

  describe('collectPrefersColorScheme', () => {
    it('returns dark when user prefers dark scheme', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: vi.fn((query: string) => ({
            matches: query === '(prefers-color-scheme: dark)',
          })),
        },
        writable: true,
        configurable: true,
      });
      expect(collectPrefersColorScheme()).toBe('dark');
    });

    it('returns light when user prefers light scheme', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: vi.fn((query: string) => ({
            matches: query === '(prefers-color-scheme: light)',
          })),
        },
        writable: true,
        configurable: true,
      });
      expect(collectPrefersColorScheme()).toBe('light');
    });

    it('returns no-preference when no scheme preferred', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: vi.fn(() => ({ matches: false })),
        },
        writable: true,
        configurable: true,
      });
      expect(collectPrefersColorScheme()).toBe('no-preference');
    });
  });

  describe('collectGpuRenderer', () => {
    const originalDocument = globalThis.document;

    afterEach(() => {
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    });

    it('returns undefined when document is unavailable', () => {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(collectGpuRenderer()).toBeUndefined();
    });

    it('returns renderer string when WebGL debug info is available', () => {
      const mockExtension = { UNMASKED_RENDERER_WEBGL: 0x9246 };
      const mockGl = {
        getExtension: vi.fn((name: string) =>
          name === 'WEBGL_debug_renderer_info' ? mockExtension : null,
        ),
        getParameter: vi.fn((param: number) =>
          param === 0x9246 ? 'NVIDIA GeForce RTX 3080' : null,
        ),
      };
      const mockCanvas = {
        getContext: vi.fn((type: string) => (type === 'webgl' ? mockGl : null)),
      };
      Object.defineProperty(globalThis, 'document', {
        value: { createElement: vi.fn(() => mockCanvas) },
        writable: true,
        configurable: true,
      });
      expect(collectGpuRenderer()).toBe('NVIDIA GeForce RTX 3080');
    });

    it('returns undefined when WebGL is not supported', () => {
      const mockCanvas = {
        getContext: vi.fn(() => null),
      };
      Object.defineProperty(globalThis, 'document', {
        value: { createElement: vi.fn(() => mockCanvas) },
        writable: true,
        configurable: true,
      });
      expect(collectGpuRenderer()).toBeUndefined();
    });

    it('returns undefined when debug extension is not available', () => {
      const mockGl = {
        getExtension: vi.fn(() => null),
      };
      const mockCanvas = {
        getContext: vi.fn((type: string) => (type === 'webgl' ? mockGl : null)),
      };
      Object.defineProperty(globalThis, 'document', {
        value: { createElement: vi.fn(() => mockCanvas) },
        writable: true,
        configurable: true,
      });
      expect(collectGpuRenderer()).toBeUndefined();
    });
  });

  describe('collectSignals', () => {
    it('collects all signals into an object', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          hardwareConcurrency: 4,
          deviceMemory: 8,
          userAgent: 'Test/1.0',
          connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'window', {
        value: {
          innerWidth: 1024,
          innerHeight: 768,
          devicePixelRatio: 2,
          matchMedia: vi.fn(() => ({ matches: false })),
        },
        writable: true,
        configurable: true,
      });
      const signals = collectSignals();
      expect(signals.hardwareConcurrency).toBe(4);
      expect(signals.deviceMemory).toBe(8);
      expect(signals.userAgent).toBe('Test/1.0');
      expect(signals.viewport).toEqual({ width: 1024, height: 768 });
      expect(signals.pixelRatio).toBe(2);
      expect(signals.connection).toEqual({
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      });
    });
  });
});
