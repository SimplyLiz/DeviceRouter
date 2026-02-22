import type { Context, Next } from 'koa';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds } from '@device-router/types';

declare module 'koa' {
  interface DefaultState {
    deviceProfile?: ClassifiedProfile | null;
  }
}

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
}

export function createMiddleware(options: MiddlewareOptions) {
  const { storage, cookieName = 'dr_session', thresholds } = options;

  return async (ctx: Context, next: Next): Promise<void> => {
    const sessionToken = ctx.cookies.get(cookieName);

    if (!sessionToken) {
      ctx.state.deviceProfile = null;
      await next();
      return;
    }

    const profile = await storage.get(sessionToken);

    if (!profile) {
      ctx.state.deviceProfile = null;
      await next();
      return;
    }

    const tiers = classify(profile.signals, thresholds);
    const hints = deriveHints(tiers, profile.signals);

    ctx.state.deviceProfile = { profile, tiers, hints };
    await next();
  };
}
