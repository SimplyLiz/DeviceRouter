import type { Context, Next } from 'koa';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints, classifyFromHeaders, resolveFallback } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds, FallbackProfile } from '@device-router/types';
import { ACCEPT_CH_VALUE } from '@device-router/types';

declare module 'koa' {
  interface DefaultState {
    deviceProfile?: ClassifiedProfile | null;
  }
}

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
}

export function createMiddleware(options: MiddlewareOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    thresholds,
    fallbackProfile,
    classifyFromHeaders: useHeaders,
  } = options;

  return async (ctx: Context, next: Next): Promise<void> => {
    if (useHeaders) {
      ctx.set('Accept-CH', ACCEPT_CH_VALUE);
    }

    const sessionToken = ctx.cookies.get(cookieName);

    if (!sessionToken) {
      ctx.state.deviceProfile = resolveFirstRequest(
        ctx.request.headers,
        useHeaders,
        fallbackProfile,
      );
      await next();
      return;
    }

    const profile = await storage.get(sessionToken);

    if (!profile) {
      ctx.state.deviceProfile = resolveFirstRequest(
        ctx.request.headers,
        useHeaders,
        fallbackProfile,
      );
      await next();
      return;
    }

    const tiers = classify(profile.signals, thresholds);
    const hints = deriveHints(tiers, profile.signals);

    ctx.state.deviceProfile = { profile, tiers, hints, source: 'probe' };
    await next();
  };
}

function resolveFirstRequest(
  headers: Record<string, string | string[] | undefined>,
  useHeaders?: boolean,
  fallbackProfile?: FallbackProfile,
): ClassifiedProfile | null {
  if (useHeaders) {
    const flat: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(headers)) {
      flat[k] = Array.isArray(v) ? v[0] : v;
    }
    const tiers = classifyFromHeaders(flat);
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
