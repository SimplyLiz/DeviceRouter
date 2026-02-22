import type { Request, Response } from 'express';
import type { StorageAdapter } from '@device-router/storage';
import type { DeviceProfile, RawSignals } from '@device-router/types';
import { randomUUID } from 'node:crypto';

export interface EndpointOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  ttl?: number;
}

function isValidSignals(body: unknown): body is RawSignals {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (b.hardwareConcurrency !== undefined && typeof b.hardwareConcurrency !== 'number')
    return false;
  if (b.deviceMemory !== undefined && typeof b.deviceMemory !== 'number') return false;
  if (b.userAgent !== undefined && typeof b.userAgent !== 'string') return false;
  if (b.pixelRatio !== undefined && typeof b.pixelRatio !== 'number') return false;
  if (b.prefersReducedMotion !== undefined && typeof b.prefersReducedMotion !== 'boolean')
    return false;
  if (
    b.prefersColorScheme !== undefined &&
    b.prefersColorScheme !== 'light' &&
    b.prefersColorScheme !== 'dark' &&
    b.prefersColorScheme !== 'no-preference'
  )
    return false;
  return true;
}

export function createProbeEndpoint(options: EndpointOptions) {
  const { storage, cookieName = 'dr_session', cookiePath = '/', ttl = 86400 } = options;

  return async (req: Request, res: Response): Promise<void> => {
    try {
      const signals = req.body as unknown;

      if (!isValidSignals(signals)) {
        res.status(400).json({ ok: false, error: 'Invalid probe payload' });
        return;
      }

      const existingToken = req.cookies?.[cookieName] as string | undefined;
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

      res.cookie(cookieName, sessionToken, {
        path: cookiePath,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: ttl * 1000,
      });

      res.json({ ok: true, sessionToken });
    } catch {
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  };
}
