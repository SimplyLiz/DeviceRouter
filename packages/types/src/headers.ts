import type { DeviceTiers, ClassifiedProfile, FallbackProfile, MemoryTier } from './profile.js';
import { CONSERVATIVE_TIERS, OPTIMISTIC_TIERS } from './classify.js';
import { deriveHints } from './hints.js';

const MOBILE_UA = /Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i;
const TABLET_UA = /iPad|Android(?!.*Mobile)|Tablet|Silk|Kindle|PlayBook/i;

export const ACCEPT_CH_VALUE = 'Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Device-Memory, Save-Data';

export function classifyFromHeaders(headers: Record<string, string | undefined>): DeviceTiers {
  const ua = headers['user-agent'] ?? '';
  const chMobile = headers['sec-ch-ua-mobile'];
  const deviceMemory = headers['device-memory'];
  const saveData = headers['save-data'];

  let tiers: DeviceTiers;

  if (chMobile === '?1' || MOBILE_UA.test(ua)) {
    tiers = { cpu: 'low', memory: 'low', connection: '4g', gpu: 'mid' };
  } else if (TABLET_UA.test(ua)) {
    tiers = { cpu: 'mid', memory: 'mid', connection: '4g', gpu: 'mid' };
  } else {
    tiers = { cpu: 'high', memory: 'high', connection: 'fast', gpu: 'mid' };
  }

  if (deviceMemory) {
    const mem = parseFloat(deviceMemory);
    if (!isNaN(mem)) {
      let memoryTier: MemoryTier;
      if (mem <= 2) memoryTier = 'low';
      else if (mem <= 4) memoryTier = 'mid';
      else memoryTier = 'high';
      tiers = { ...tiers, memory: memoryTier };
    }
  }

  if (saveData === 'on') {
    tiers = { ...tiers, connection: '3g' };
  }

  return tiers;
}

export function resolveFallback(fallback: FallbackProfile): ClassifiedProfile {
  let tiers: DeviceTiers;
  if (fallback === 'conservative') {
    tiers = { ...CONSERVATIVE_TIERS };
  } else if (fallback === 'optimistic') {
    tiers = { ...OPTIMISTIC_TIERS };
  } else {
    tiers = { ...fallback };
  }

  const profile = {
    schemaVersion: 1 as const,
    sessionToken: '',
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    signals: {},
  };

  return {
    profile,
    tiers,
    hints: deriveHints(tiers),
    source: 'fallback',
  };
}
