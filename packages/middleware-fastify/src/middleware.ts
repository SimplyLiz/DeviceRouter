import type { FastifyRequest } from 'fastify';
import '@fastify/cookie';
import type { StorageAdapter } from '@device-router/storage';
import { classify, deriveHints } from '@device-router/types';
import type { ClassifiedProfile, TierThresholds } from '@device-router/types';

declare module 'fastify' {
  interface FastifyRequest {
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

  return async (req: FastifyRequest): Promise<void> => {
    const sessionToken = req.cookies?.[cookieName];

    if (!sessionToken) {
      req.deviceProfile = null;
      return;
    }

    const profile = await storage.get(sessionToken);

    if (!profile) {
      req.deviceProfile = null;
      return;
    }

    const tiers = classify(profile.signals, thresholds);
    const hints = deriveHints(tiers, profile.signals);

    req.deviceProfile = { profile, tiers, hints };
  };
}
