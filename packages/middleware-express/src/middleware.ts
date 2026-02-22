import type { Request, Response, NextFunction } from 'express';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds } from '@device-router/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      deviceProfile?: ClassifiedProfile | null;
    }
  }
}

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
}

export function createMiddleware(options: MiddlewareOptions) {
  const { storage, cookieName = 'dr_session', thresholds } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionToken = req.cookies?.[cookieName] as string | undefined;

      if (!sessionToken) {
        req.deviceProfile = null;
        next();
        return;
      }

      const profile = await storage.get(sessionToken);

      if (!profile) {
        req.deviceProfile = null;
        next();
        return;
      }

      const tiers = classify(profile.signals, thresholds);
      const hints = deriveHints(tiers, profile.signals);

      req.deviceProfile = { profile, tiers, hints };
      next();
    } catch (err) {
      next(err);
    }
  };
}
