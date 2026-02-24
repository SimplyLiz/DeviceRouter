import type { Context } from 'koa';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals, OnEventCallback } from '@device-router/types';
import { isValidSignals, isBotSignals, emitEvent } from '@device-router/types';
import { randomUUID } from 'node:crypto';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  rejectBots?: boolean;
  onEvent?: OnEventCallback;
}

export function createProbeEndpoint(options: EndpointOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure = false,
    ttl = 86400,
    rejectBots = true,
    onEvent,
  } = options;

  return async (ctx: Context): Promise<void> => {
    let sessionToken: string | undefined;
    try {
      const signals = (ctx.request as unknown as { body: unknown }).body;

      if (!isValidSignals(signals)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'Invalid probe payload' };
        return;
      }

      const existingToken = ctx.cookies.get(cookieName);
      sessionToken = existingToken || randomUUID();

      if (rejectBots && isBotSignals(signals)) {
        emitEvent(onEvent, { type: 'bot:reject', sessionToken, signals });
        ctx.status = 403;
        ctx.body = { ok: false, error: 'Bot detected' };
        return;
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

      ctx.cookies.set(cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'lax',
        maxAge: ttl * 1000,
      });

      ctx.body = { ok: true, sessionToken };
    } catch (err) {
      emitEvent(onEvent, {
        type: 'error',
        error: err,
        phase: 'endpoint',
        sessionToken,
      });
      ctx.status = 500;
      ctx.body = { ok: false, error: 'Internal server error' };
    }
  };
}
