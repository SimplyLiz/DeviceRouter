import type { StorageAdapter } from '@device-router/storage';
import { createMiddleware } from './middleware.js';
import { createProbeEndpoint } from './endpoint.js';

export interface DeviceRouterOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  ttl?: number;
  probePath?: string;
}

export function createDeviceRouter(options: DeviceRouterOptions) {
  const { storage, cookieName = 'dr_session', cookiePath = '/', ttl = 86400 } = options;

  return {
    middleware: createMiddleware({ storage, cookieName }),
    probeEndpoint: createProbeEndpoint({ storage, cookieName, cookiePath, ttl }),
  };
}

export { createMiddleware } from './middleware.js';
export { createProbeEndpoint } from './endpoint.js';
export type { MiddlewareOptions } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
