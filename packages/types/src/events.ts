import type { DeviceTiers, RenderingHints, RawSignals, ProfileSource } from './profile.js';

export type DeviceRouterEvent =
  | {
      type: 'profile:classify';
      sessionToken: string;
      tiers: DeviceTiers;
      hints: RenderingHints;
      source: ProfileSource;
      durationMs: number;
    }
  | {
      type: 'profile:store';
      sessionToken: string;
      signals: RawSignals;
      durationMs: number;
    }
  | {
      type: 'bot:reject';
      sessionToken: string;
      signals: RawSignals;
    }
  | {
      type: 'error';
      error: unknown;
      phase: 'middleware' | 'endpoint';
      sessionToken?: string;
    }
  | {
      type: 'diagnostic:no-probe-data';
      middlewareInvocations: number;
      probePath: string;
    };

export type OnEventCallback = (event: DeviceRouterEvent) => void | Promise<void>;

export function emitEvent(onEvent: OnEventCallback | undefined, event: DeviceRouterEvent): void {
  if (!onEvent) return;
  try {
    const result = onEvent(event);
    if (result && typeof result.then === 'function') {
      result.then(undefined, () => {});
    }
  } catch {
    // Swallow sync errors — callbacks must never disrupt request handling
  }
}
