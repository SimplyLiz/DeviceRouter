import type { StorageAdapter } from '@device-router/storage';
import type { TierThresholds } from '@device-router/types';
import fp from 'fastify-plugin';
import { createMiddleware } from './middleware.js';
import { createProbeEndpoint } from './endpoint.js';

export interface DeviceRouterOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  ttl?: number;
  thresholds?: TierThresholds;
}

export function createDeviceRouter(options: DeviceRouterOptions) {
  const { storage, cookieName = 'dr_session', cookiePath = '/', ttl = 86400, thresholds } = options;

  const hook = createMiddleware({ storage, cookieName, thresholds });

  const plugin = fp(
    async (fastify) => {
      fastify.addHook('preHandler', hook);
    },
    { name: 'device-router' },
  );

  const pluginOptions = {};

  return {
    plugin,
    pluginOptions,
    probeEndpoint: createProbeEndpoint({ storage, cookieName, cookiePath, ttl }),
  };
}

export { createMiddleware } from './middleware.js';
export { createProbeEndpoint } from './endpoint.js';
export type { MiddlewareOptions } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
