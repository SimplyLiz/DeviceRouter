import { collectSignals } from './signals.js';
import { getCookie } from './probe.js';
import { collectBattery, sendProbe, handleProbeResponse } from './_internal.js';
import type { ProbeOptions } from './probe.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export interface ProbeWithRetryOptions extends ProbeOptions {
  retry?: RetryOptions;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runProbeWithRetry(options: ProbeWithRetryOptions = {}): Promise<void> {
  const {
    endpoint = '/device-router/probe',
    cookieName = 'device-router-session',
    cookiePath = '/',
    retry = {},
  } = options;

  const { maxRetries = 3, baseDelay = 500, maxDelay = 5000 } = retry;

  if (getCookie(cookieName)) return;

  const signals = collectSignals();
  await collectBattery(signals);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await sendProbe(signals, endpoint);
      if (response.ok) {
        await handleProbeResponse(response, cookieName, cookiePath);
        return;
      }
      if (response.status < 500) return; // 4xx — don't retry
      // 5xx — fall through to backoff
    } catch {
      // Network error — fall through to backoff
    }
    if (attempt >= maxRetries) return;
    const delay = Math.min(baseDelay * 2 ** attempt + Math.random() * baseDelay, maxDelay);
    await sleep(delay);
  }
}
