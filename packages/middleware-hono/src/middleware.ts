import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds } from '@device-router/types';

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
}

export type DeviceRouterEnv = {
  Variables: {
    deviceProfile: ClassifiedProfile | null;
  };
};

export function createMiddleware(options: MiddlewareOptions): MiddlewareHandler<DeviceRouterEnv> {
  const { storage, cookieName = 'dr_session', thresholds } = options;

  return async (c: Context<DeviceRouterEnv>, next) => {
    const sessionToken = getCookie(c, cookieName);

    if (!sessionToken) {
      c.set('deviceProfile', null);
      await next();
      return;
    }

    const profile = await storage.get(sessionToken);

    if (!profile) {
      c.set('deviceProfile', null);
      await next();
      return;
    }

    const tiers = classify(profile.signals, thresholds);
    const hints = deriveHints(tiers, profile.signals);

    c.set('deviceProfile', { profile, tiers, hints });
    await next();
  };
}
