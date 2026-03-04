import type {
  DeviceTiers,
  RenderingHints,
  StoredSignals,
  RawSignals,
  ProfileSource,
} from './profile.js';

export type DeviceRouterEvent =
  | {
      type: 'profile:classify';
      sessionToken: string;
      tiers: DeviceTiers;
      hints: RenderingHints;
      source: ProfileSource;
      /** Time in ms to run classify() + deriveHints() */
      durationMs: number;
    }
  | {
      type: 'profile:store';
      sessionToken: string;
      signals: StoredSignals;
      /** Time in ms for the storage.set() I/O operation */
      durationMs: number;
    }
  | {
      type: 'bot:reject';
      sessionToken: string;
      signals: RawSignals;
      /** Time in ms for signal validation + bot detection */
      durationMs: number;
    }
  | {
      type: 'error';
      error: unknown;
      errorMessage: string;
      phase: 'middleware' | 'endpoint';
      sessionToken?: string;
    }
  | {
      type: 'diagnostic:no-probe-data';
      middlewareInvocations: number;
      probePath: string;
    };

export type OnEventCallback = (event: DeviceRouterEvent) => void | Promise<void>;

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as Record<string, unknown>).message === 'string'
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return String(err);
}

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
