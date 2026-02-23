import type { FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/cookie';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints, classifyFromHeaders, resolveFallback } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds, FallbackProfile } from '@device-router/types';
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
}

export function createMiddleware(options: MiddlewareOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    thresholds,
    fallbackProfile,
    classifyFromHeaders: useHeaders,
  } = options;

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (useHeaders) {
      reply.header('Accept-CH', ACCEPT_CH_VALUE);
    }

    const sessionToken = req.cookies?.[cookieName];

    if (!sessionToken) {
      req.deviceProfile = resolveFirstRequest(req.headers, useHeaders, fallbackProfile);
      return;
    }

    const profile = await storage.get(sessionToken);

    if (!profile) {
      req.deviceProfile = resolveFirstRequest(req.headers, useHeaders, fallbackProfile);
      return;
    }

    const tiers = classify(profile.signals, thresholds);
    const hints = deriveHints(tiers, profile.signals);

    req.deviceProfile = { profile, tiers, hints, source: 'probe' };
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
