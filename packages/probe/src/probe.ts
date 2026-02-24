import { collectSignals } from './signals.js';

export interface ProbeOptions {
  endpoint?: string;
  cookieName?: string;
  cookiePath?: string;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, path: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=${path};SameSite=Lax`;
}

export async function runProbe(options: ProbeOptions = {}): Promise<void> {
  const {
    endpoint = '/device-router/probe',
    cookieName = 'device-router-session',
    cookiePath = '/',
  } = options;

  if (getCookie(cookieName)) return;

  const signals = collectSignals();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bm = await (navigator as any).getBattery();
    signals.battery = { level: bm.level, charging: bm.charging };
  } catch {
    // API unavailable (Firefox, Safari) — leave undefined
  }

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
  } catch {
    // Silently fail — probe is non-critical
  }
}
