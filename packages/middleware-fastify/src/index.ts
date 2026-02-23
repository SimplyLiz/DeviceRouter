import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { StorageAdapter } from '@device-router/storage';
import type { TierThresholds, FallbackProfile } from '@device-router/types';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createMiddleware } from './middleware.js';
import { createProbeEndpoint } from './endpoint.js';
import { createInjectionHook } from './inject.js';

export interface DeviceRouterOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  ttl?: number;
  thresholds?: TierThresholds;
  rejectBots?: boolean;
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
  injectProbe?: boolean;
  probePath?: string;
  probeNonce?: string | ((req: FastifyRequest) => string);
}

export function createDeviceRouter(options: DeviceRouterOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    ttl = 86400,
    thresholds,
    rejectBots,
    fallbackProfile,
    classifyFromHeaders,
    injectProbe = false,
    probePath,
    probeNonce,
  } = options;

  const hook = createMiddleware({
    storage,
    cookieName,
    thresholds,
    fallbackProfile,
    classifyFromHeaders,
  });

  let injectionHook: ReturnType<typeof createInjectionHook> | undefined;

  if (injectProbe) {
    const require = createRequire(import.meta.url);
    const probeBundlePath = require.resolve('@device-router/probe/dist/device-router-probe.min.js');
    let probeScript = readFileSync(probeBundlePath, 'utf-8');

    if (probePath) {
      probeScript = probeScript.replace('"/device-router/probe"', JSON.stringify(probePath));
    }

    injectionHook = createInjectionHook({
      probeScript,
      nonce: probeNonce,
    });
  }

  const plugin = fp(
    async (fastify) => {
      fastify.addHook('preHandler', hook);
      if (injectionHook) {
        fastify.addHook('onSend', injectionHook);
      }
    },
    { name: 'device-router' },
  );

  const pluginOptions = {};

  return {
    plugin,
    pluginOptions,
    probeEndpoint: createProbeEndpoint({ storage, cookieName, cookiePath, ttl, rejectBots }),
    injectionHook,
  };
}

export { createMiddleware } from './middleware.js';
export { createProbeEndpoint } from './endpoint.js';
export { createInjectionHook } from './inject.js';
export type { MiddlewareOptions } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
export type { InjectOptions } from './inject.js';
