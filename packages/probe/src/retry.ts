import { collectSignals } from './signals.js';
import type { ProbeOptions } from './probe.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export interface ProbeWithRetryOptions extends ProbeOptions {
  retry?: RetryOptions;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, path: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=${path};SameSite=Lax`;
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bm = await (navigator as any).getBattery();
    signals.battery = { level: bm.level, charging: bm.charging };
  } catch {
    // API unavailable (Firefox, Safari) — leave undefined
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signals),
      });

      if (response.ok) {
        const data = (await response.json()) as { sessionToken?: string };
        if (data.sessionToken) {
          setCookie(cookieName, data.sessionToken, cookiePath);
        }
      }
      return;
    } catch {
      if (attempt >= maxRetries) return;
      const delay = Math.min(baseDelay * 2 ** attempt + Math.random() * baseDelay, maxDelay);
      await sleep(delay);
    }
  }
}
