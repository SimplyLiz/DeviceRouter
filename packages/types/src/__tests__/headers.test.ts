import { describe, it, expect } from 'vitest';
import { classifyFromHeaders, resolveFallback, ACCEPT_CH_VALUE } from '../headers.js';
import { CONSERVATIVE_TIERS, OPTIMISTIC_TIERS } from '../classify.js';

describe('classifyFromHeaders', () => {
  it('classifies desktop UA as high-end', () => {
    const tiers = classifyFromHeaders({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
    });
    expect(tiers).toEqual({ cpu: 'high', memory: 'high', connection: 'fast', gpu: 'mid' });
  });

  it('classifies iPhone UA as mobile', () => {
    const tiers = classifyFromHeaders({
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    });
    expect(tiers).toEqual({ cpu: 'low', memory: 'low', connection: '4g', gpu: 'mid' });
  });

  it('classifies iPad UA as tablet', () => {
    const tiers = classifyFromHeaders({
      'user-agent':
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    });
    expect(tiers).toEqual({ cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'mid' });
  });

  it('classifies Android mobile UA', () => {
    const tiers = classifyFromHeaders({
      'user-agent':
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    expect(tiers).toEqual({ cpu: 'low', memory: 'low', connection: '4g', gpu: 'mid' });
  });

  it('classifies Android tablet UA', () => {
    const tiers = classifyFromHeaders({
      'user-agent':
        'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });
    expect(tiers).toEqual({ cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'mid' });
  });

  it('classifies empty/missing UA as desktop', () => {
    expect(classifyFromHeaders({})).toEqual({
      cpu: 'high',
      memory: 'high',
      connection: 'fast',
      gpu: 'mid',
    });
    expect(classifyFromHeaders({ 'user-agent': '' })).toEqual({
      cpu: 'high',
      memory: 'high',
      connection: 'fast',
      gpu: 'mid',
    });
  });

  describe('Client Hints overrides', () => {
    it('sec-ch-ua-mobile ?1 forces mobile classification', () => {
      const tiers = classifyFromHeaders({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        'sec-ch-ua-mobile': '?1',
      });
      expect(tiers.cpu).toBe('low');
      expect(tiers.memory).toBe('low');
    });

    it('device-memory overrides memory tier', () => {
      const tiers = classifyFromHeaders({
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'device-memory': '8',
      });
      expect(tiers.memory).toBe('high');
      expect(tiers.cpu).toBe('low');
    });

    it('device-memory low value', () => {
      const tiers = classifyFromHeaders({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        'device-memory': '1',
      });
      expect(tiers.memory).toBe('low');
    });

    it('device-memory mid value', () => {
      const tiers = classifyFromHeaders({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        'device-memory': '4',
      });
      expect(tiers.memory).toBe('mid');
    });

    it('save-data on forces connection to 3g', () => {
      const tiers = classifyFromHeaders({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        'save-data': 'on',
      });
      expect(tiers.connection).toBe('3g');
      expect(tiers.cpu).toBe('high');
    });

    it('Client Hints take priority over UA for mobile detection', () => {
      const tiers = classifyFromHeaders({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        'sec-ch-ua-mobile': '?1',
        'device-memory': '8',
      });
      expect(tiers.cpu).toBe('low');
      expect(tiers.memory).toBe('high');
    });

    it('ignores invalid device-memory', () => {
      const tiers = classifyFromHeaders({
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        'device-memory': 'abc',
      });
      expect(tiers.memory).toBe('high');
    });
  });
});

describe('resolveFallback', () => {
  it('resolves conservative preset', () => {
    const result = resolveFallback('conservative');
    expect(result.tiers).toEqual(CONSERVATIVE_TIERS);
    expect(result.source).toBe('fallback');
    expect(result.hints.deferHeavyComponents).toBe(true);
    expect(result.hints.serveMinimalCSS).toBe(true);
    expect(result.profile.sessionToken).toBe('');
    expect(result.profile.signals).toEqual({});
  });

  it('resolves optimistic preset', () => {
    const result = resolveFallback('optimistic');
    expect(result.tiers).toEqual(OPTIMISTIC_TIERS);
    expect(result.source).toBe('fallback');
    expect(result.hints.deferHeavyComponents).toBe(false);
    expect(result.hints.serveMinimalCSS).toBe(false);
  });

  it('resolves custom DeviceTiers', () => {
    const custom = {
      cpu: 'mid' as const,
      memory: 'high' as const,
      connection: '4g' as const,
      gpu: 'low' as const,
    };
    const result = resolveFallback(custom);
    expect(result.tiers).toEqual(custom);
    expect(result.source).toBe('fallback');
    expect(result.hints.disable3dEffects).toBe(true);
  });
});

describe('preset constants', () => {
  it('CONSERVATIVE_TIERS has expected shape', () => {
    expect(CONSERVATIVE_TIERS).toEqual({
      cpu: 'low',
      memory: 'low',
      connection: '3g',
      gpu: 'low',
    });
  });

  it('OPTIMISTIC_TIERS has expected shape', () => {
    expect(OPTIMISTIC_TIERS).toEqual({
      cpu: 'high',
      memory: 'high',
      connection: 'fast',
      gpu: 'mid',
    });
  });
});

describe('ACCEPT_CH_VALUE', () => {
  it('contains expected hints', () => {
    expect(ACCEPT_CH_VALUE).toContain('Sec-CH-UA-Mobile');
    expect(ACCEPT_CH_VALUE).toContain('Device-Memory');
    expect(ACCEPT_CH_VALUE).toContain('Save-Data');
  });
});
