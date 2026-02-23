import type { Context, Handler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals } from '@device-router/types';
import { isValidSignals, isBotSignals } from '@device-router/types';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  rejectBots?: boolean;
}

export function createProbeEndpoint(options: EndpointOptions): Handler {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure = false,
    ttl = 86400,
    rejectBots = true,
  } = options;

  return async (c: Context) => {
    try {
      const signals = await c.req.json();

      if (!isValidSignals(signals)) {
        return c.json({ ok: false, error: 'Invalid probe payload' }, 400);
      }

      if (rejectBots && isBotSignals(signals)) {
        return c.json({ ok: false, error: 'Bot detected' }, 403);
      }

      const existingToken = getCookie(c, cookieName);
      const sessionToken = existingToken || globalThis.crypto.randomUUID();

      const {
        userAgent: _userAgent,
        viewport: _viewport,
        ...storedSignals
      } = signals as RawSignals;

      const now = new Date();
      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
        signals: storedSignals,
      };

      await storage.set(sessionToken, profile, ttl);

      setCookie(c, cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'Lax',
        maxAge: ttl,
      });

      return c.json({ ok: true, sessionToken });
    } catch {
      return c.json({ ok: false, error: 'Internal server error' }, 500);
    }
  };
}
