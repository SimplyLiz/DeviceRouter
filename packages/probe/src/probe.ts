import { collectSignals } from './signals.js';

export interface ProbeOptions {
  endpoint?: string;
  cookieName?: string;
  cookiePath?: string;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, path: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=${path}; SameSite=Lax`;
}

export async function runProbe(options: ProbeOptions = {}): Promise<void> {
  const {
    endpoint = '/device-router/probe',
    cookieName = 'dr_session',
    cookiePath = '/',
  } = options;

  const existingSession = getCookie(cookieName);
  if (existingSession) return;

  const signals = collectSignals();

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
