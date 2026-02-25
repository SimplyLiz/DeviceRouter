import type { Context, Handler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals, OnEventCallback } from '@device-router/types';
import { isValidSignals, isBotSignals, emitEvent, extractErrorMessage } from '@device-router/types';

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
    cookieName = 'device-router-session',
    cookiePath = '/',
    cookieSecure = false,
    ttl = 86400,
    rejectBots = true,
    onEvent,
  } = options;

  return async (c: Context) => {
    let sessionToken: string | undefined;
    try {
      const validationStart = performance.now();

      let signals: unknown;
      try {
        signals = await c.req.json();
      } catch {
        return c.json({ ok: false, error: 'Invalid probe payload' }, 400);
      }

      if (!isValidSignals(signals)) {
        return c.json({ ok: false, error: 'Invalid probe payload' }, 400);
      }

      const existingToken = getCookie(c, cookieName);
      sessionToken = existingToken || globalThis.crypto.randomUUID();

      if (rejectBots && isBotSignals(signals)) {
        const durationMs = performance.now() - validationStart;
        emitEvent(onEvent, { type: 'bot:reject', sessionToken, signals, durationMs });
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

      emitEvent(onEvent, {
        type: 'profile:store',
        sessionToken,
        signals: storedSignals,
        durationMs,
      });

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
        errorMessage: extractErrorMessage(err),
        phase: 'endpoint',
        sessionToken,
      });
      return c.json({ ok: false, error: 'Internal server error' }, 500);
    }
  };
}
