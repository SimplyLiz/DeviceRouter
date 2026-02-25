import { setCookie } from './probe.js';
import type { ProbeSignals } from './signals.js';

export async function collectBattery(signals: ProbeSignals): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bm = await (navigator as any).getBattery();
    signals.battery = { level: bm.level, charging: bm.charging };
  } catch {
    // API unavailable (Firefox, Safari) — leave undefined
  }
}

export function sendProbe(signals: ProbeSignals, endpoint: string): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signals),
  });
}

export async function handleProbeResponse(
  response: Response,
  cookieName: string,
  cookiePath: string,
): Promise<void> {
  const data = (await response.json()) as { sessionToken?: string };
  if (data.sessionToken) {
    setCookie(cookieName, data.sessionToken, cookiePath);
  }
}
