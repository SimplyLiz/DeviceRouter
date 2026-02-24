import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { StorageAdapter } from '@device-router/storage';
import {
  classify,
  deriveHints,
  classifyFromHeaders,
  resolveFallback,
  emitEvent,
  validateThresholds,
} from '@device-router/types';
import type {
  ClassifiedProfile,
  TierThresholds,
  FallbackProfile,
  OnEventCallback,
} from '@device-router/types';
import { ACCEPT_CH_VALUE } from '@device-router/types';

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
  onEvent?: OnEventCallback;
}

export type DeviceRouterEnv = {
  Variables: {
    deviceProfile: ClassifiedProfile | null;
  };
};

export function createMiddleware(options: MiddlewareOptions): MiddlewareHandler<DeviceRouterEnv> {
  const {
    storage,
    cookieName = 'device-router-session',
    thresholds,
    fallbackProfile,
    classifyFromHeaders: useHeaders,
    onEvent,
  } = options;

  if (thresholds) validateThresholds(thresholds);

  return async (c: Context<DeviceRouterEnv>, next) => {
    try {
      if (useHeaders) {
        c.header('Accept-CH', ACCEPT_CH_VALUE);
      }

      const sessionToken = getCookie(c, cookieName);

      if (!sessionToken) {
        const start = performance.now();
        const result = resolveFirstRequest(c, useHeaders, fallbackProfile);
        c.set('deviceProfile', result);
        if (result) {
          emitEvent(onEvent, {
            type: 'profile:classify',
            sessionToken: '',
            tiers: result.tiers,
            hints: result.hints,
            source: result.source,
            durationMs: performance.now() - start,
          });
        }
        await next();
        return;
      }

      const profile = await storage.get(sessionToken);

      if (!profile) {
        const start = performance.now();
        const result = resolveFirstRequest(c, useHeaders, fallbackProfile);
        c.set('deviceProfile', result);
        if (result) {
          emitEvent(onEvent, {
            type: 'profile:classify',
            sessionToken,
            tiers: result.tiers,
            hints: result.hints,
            source: result.source,
            durationMs: performance.now() - start,
          });
        }
        await next();
        return;
      }

      const start = performance.now();
      const tiers = classify(profile.signals, thresholds);
      const hints = deriveHints(tiers, profile.signals);
      const durationMs = performance.now() - start;

      c.set('deviceProfile', { profile, tiers, hints, source: 'probe' });
      emitEvent(onEvent, {
        type: 'profile:classify',
        sessionToken,
        tiers,
        hints,
        source: 'probe',
        durationMs,
      });
      await next();
    } catch (err) {
      emitEvent(onEvent, {
        type: 'error',
        error: err,
        phase: 'middleware',
        sessionToken: getCookie(c, cookieName),
      });
      throw err;
    }
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
