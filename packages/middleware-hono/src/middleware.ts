import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints, classifyFromHeaders, resolveFallback } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds, FallbackProfile } from '@device-router/types';
import { ACCEPT_CH_VALUE } from '@device-router/types';

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
}

export type DeviceRouterEnv = {
  Variables: {
    deviceProfile: ClassifiedProfile | null;
  };
};

export function createMiddleware(options: MiddlewareOptions): MiddlewareHandler<DeviceRouterEnv> {
  const {
    storage,
    cookieName = 'dr_session',
    thresholds,
    fallbackProfile,
    classifyFromHeaders: useHeaders,
  } = options;

  return async (c: Context<DeviceRouterEnv>, next) => {
    if (useHeaders) {
      c.header('Accept-CH', ACCEPT_CH_VALUE);
    }

    const sessionToken = getCookie(c, cookieName);

    if (!sessionToken) {
      c.set('deviceProfile', resolveFirstRequest(c, useHeaders, fallbackProfile));
      await next();
      return;
    }

    const profile = await storage.get(sessionToken);

    if (!profile) {
      c.set('deviceProfile', resolveFirstRequest(c, useHeaders, fallbackProfile));
      await next();
      return;
    }

    const tiers = classify(profile.signals, thresholds);
    const hints = deriveHints(tiers, profile.signals);

    c.set('deviceProfile', { profile, tiers, hints, source: 'probe' });
    await next();
  };
}

function resolveFirstRequest(
  c: Context,
  useHeaders?: boolean,
  fallbackProfile?: FallbackProfile,
): ClassifiedProfile | null {
  if (useHeaders) {
    const headerObj: Record<string, string | undefined> = {
      'user-agent': c.req.header('user-agent'),
      'sec-ch-ua-mobile': c.req.header('sec-ch-ua-mobile'),
      'sec-ch-ua-platform': c.req.header('sec-ch-ua-platform'),
      'device-memory': c.req.header('device-memory'),
      'save-data': c.req.header('save-data'),
    };
    const tiers = classifyFromHeaders(headerObj);
    const hints = deriveHints(tiers);
    const profile = {
      schemaVersion: 1 as const,
      sessionToken: '',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      signals: {},
    };
    return { profile, tiers, hints, source: 'headers' };
  }

  if (fallbackProfile) {
    return resolveFallback(fallbackProfile);
  }

  return null;
}
