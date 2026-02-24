import type { OnEventCallback } from './events.js';
import { emitEvent } from './events.js';

export const NO_PROBE_DATA_THRESHOLD = 50;

export function createProbeHealthCheck(opts: { onEvent?: OnEventCallback; probePath: string }): {
  onMiddlewareHit(): void;
  onProbeReceived(): void;
} {
  let count = 0;
  let probeReceived = false;
  let warned = false;

  return {
    onProbeReceived() {
      probeReceived = true;
    },
    onMiddlewareHit() {
      if (probeReceived || warned) return;
      count++;
      if (count < NO_PROBE_DATA_THRESHOLD) return;

      warned = true;
      console.warn(
        `[DeviceRouter] ${NO_PROBE_DATA_THRESHOLD} requests handled but no probe data received. ` +
          `Verify the probe script is loaded and POST-ing to ${opts.probePath}`,
      );
      emitEvent(opts.onEvent, {
        type: 'diagnostic:no-probe-data',
        middlewareInvocations: count,
        probePath: opts.probePath,
      });
    },
  };
}
