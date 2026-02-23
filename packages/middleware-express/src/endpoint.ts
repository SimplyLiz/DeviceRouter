import type { Request, Response } from 'express';
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

  return async (req: Request, res: Response): Promise<void> => {
    try {
      const signals = req.body as unknown;

      if (!isValidSignals(signals)) {
        res.status(400).json({ ok: false, error: 'Invalid probe payload' });
        return;
      }

      if (rejectBots && isBotSignals(signals)) {
        res.status(403).json({ ok: false, error: 'Bot detected' });
        return;
      }

      const existingToken = req.cookies?.[cookieName] as string | undefined;
      const sessionToken = existingToken || randomUUID();

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

      res.cookie(cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'lax',
        maxAge: ttl * 1000,
      });

      res.json({ ok: true, sessionToken });
    } catch {
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
}
