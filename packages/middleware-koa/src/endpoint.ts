import type { Context } from 'koa';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals } from '@device-router/types';
import { isValidSignals, isBotSignals } from '@device-router/types';
import { randomUUID } from 'node:crypto';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  rejectBots?: boolean;
}

export function createProbeEndpoint(options: EndpointOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure = false,
    ttl = 86400,
    rejectBots = true,
  } = options;

  return async (ctx: Context): Promise<void> => {
    try {
      const signals = (ctx.request as unknown as { body: unknown }).body;

      if (!isValidSignals(signals)) {
        ctx.status = 400;
        ctx.body = { ok: false, error: 'Invalid probe payload' };
        return;
      }

      if (rejectBots && isBotSignals(signals)) {
        ctx.status = 403;
        ctx.body = { ok: false, error: 'Bot detected' };
        return;
      }

      const existingToken = ctx.cookies.get(cookieName);
      const sessionToken = existingToken || randomUUID();

      const now = new Date();
      const profile: DeviceProfile = {
        schemaVersion: 1,
        sessionToken,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
        signals: signals as RawSignals,
      };

      await storage.set(sessionToken, profile, ttl);

      ctx.cookies.set(cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'lax',
        maxAge: ttl * 1000,
      });

      ctx.body = { ok: true, sessionToken };
    } catch {
      ctx.status = 500;
      ctx.body = { ok: false, error: 'Internal server error' };
    }
  };
}
