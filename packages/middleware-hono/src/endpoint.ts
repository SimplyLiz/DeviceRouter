import type { Context, Handler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals, OnEventCallback } from '@device-router/types';
import { isValidSignals, isBotSignals, emitEvent } from '@device-router/types';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  rejectBots?: boolean;
  onEvent?: OnEventCallback;
}

export function createProbeEndpoint(options: EndpointOptions): Handler {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure = false,
    ttl = 86400,
    rejectBots = true,
    onEvent,
  } = options;

  return async (c: Context) => {
    try {
      const signals = await c.req.json();

      if (!isValidSignals(signals)) {
        return c.json({ ok: false, error: 'Invalid probe payload' }, 400);
      }

      const existingToken = getCookie(c, cookieName);
      const sessionToken = existingToken || globalThis.crypto.randomUUID();

      if (rejectBots && isBotSignals(signals)) {
        emitEvent(onEvent, { type: 'bot:reject', sessionToken, signals });
        return c.json({ ok: false, error: 'Bot detected' }, 403);
      }

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

      const start = performance.now();
      await storage.set(sessionToken, profile, ttl);
      const durationMs = performance.now() - start;

      emitEvent(onEvent, { type: 'profile:store', sessionToken, signals, durationMs });

      setCookie(c, cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'Lax',
        maxAge: ttl,
      });

      return c.json({ ok: true, sessionToken });
    } catch (err) {
      emitEvent(onEvent, {
        type: 'error',
        error: err,
        phase: 'endpoint',
        sessionToken: getCookie(c, cookieName),
      });
      return c.json({ ok: false, error: 'Internal server error' }, 500);
    }
  };
}
