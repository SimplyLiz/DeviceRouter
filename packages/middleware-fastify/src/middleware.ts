import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/cookie';
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

declare module 'fastify' {
  interface FastifyRequest {
    deviceProfile?: ClassifiedProfile | null;
  }
}

export interface MiddlewareOptions {
  storage: StorageAdapter;
  cookieName?: string;
  thresholds?: TierThresholds;
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
  onEvent?: OnEventCallback;
}

export function createMiddleware(options: MiddlewareOptions) {
  const {
    storage,
    cookieName = 'device-router-session',
    thresholds,
    fallbackProfile,
    classifyFromHeaders: useHeaders,
    onEvent,
  } = options;

  if (thresholds) validateThresholds(thresholds);

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      if (useHeaders) {
        reply.header('Accept-CH', ACCEPT_CH_VALUE);
      }

      const sessionToken = req.cookies?.[cookieName];

      if (!sessionToken) {
        const start = performance.now();
        const result = resolveFirstRequest(req.headers, useHeaders, fallbackProfile);
        req.deviceProfile = result;
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
        return;
      }

      const profile = await storage.get(sessionToken);

      if (!profile) {
        const start = performance.now();
        const result = resolveFirstRequest(req.headers, useHeaders, fallbackProfile);
        req.deviceProfile = result;
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
        return;
      }

      const start = performance.now();
      const tiers = classify(profile.signals, thresholds);
      const hints = deriveHints(tiers, profile.signals);
      const durationMs = performance.now() - start;

      req.deviceProfile = { profile, tiers, hints, source: 'probe' };
      emitEvent(onEvent, {
        type: 'profile:classify',
        sessionToken,
        tiers,
        hints,
        source: 'probe',
        durationMs,
      });
    } catch (err) {
      emitEvent(onEvent, {
        type: 'error',
        error: err,
        phase: 'middleware',
        sessionToken: req.cookies?.[cookieName],
      });
      throw err;
    }
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
