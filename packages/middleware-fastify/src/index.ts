import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { StorageAdapter } from '@device-router/storage';
import type { TierThresholds, FallbackProfile, OnEventCallback } from '@device-router/types';
import { validateThresholds } from '@device-router/types';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createMiddleware } from './middleware.js';
import { createProbeEndpoint } from './endpoint.js';
import { createInjectionMiddleware } from './inject.js';

export interface DeviceRouterOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  thresholds?: TierThresholds;
  rejectBots?: boolean;
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
  onEvent?: OnEventCallback;
  injectProbe?: boolean;
  probePath?: string;
  probeNonce?: string | ((req: FastifyRequest) => string);
}

export function createDeviceRouter(options: DeviceRouterOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure,
    ttl = 86400,
    thresholds,
    rejectBots,
    fallbackProfile,
    classifyFromHeaders,
    onEvent,
    injectProbe = false,
    probePath,
    probeNonce,
  } = options;

  if (thresholds) validateThresholds(thresholds);

  const hook = createMiddleware({
    storage,
    cookieName,
    thresholds,
    fallbackProfile,
    classifyFromHeaders,
    onEvent,
  });

  let injectionMiddleware: ReturnType<typeof createInjectionMiddleware> | undefined;

  if (injectProbe) {
    const require = createRequire(import.meta.url);
    const probeBundlePath = require.resolve('@device-router/probe/dist/device-router-probe.min.js');
    let probeScript = readFileSync(probeBundlePath, 'utf-8');

    if (probePath) {
      probeScript = probeScript.replace('"/device-router/probe"', JSON.stringify(probePath));
    }

    injectionMiddleware = createInjectionMiddleware({
      probeScript,
      nonce: probeNonce,
    });
  }

  const middleware = fp(
    async (fastify) => {
      fastify.addHook('preHandler', hook);
      if (injectionMiddleware) {
        fastify.addHook('onSend', injectionMiddleware);
      }
    },
    { name: 'device-router' },
  );

  return {
    middleware,
    probeEndpoint: createProbeEndpoint({
      storage,
      cookieName,
      cookiePath,
      cookieSecure,
      ttl,
      rejectBots,
      onEvent,
    }),
    injectionMiddleware,
  };
}

export { createMiddleware } from './middleware.js';
export { createProbeEndpoint } from './endpoint.js';
export { createInjectionMiddleware } from './inject.js';
export type { MiddlewareOptions } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
export type { InjectOptions } from './inject.js';
