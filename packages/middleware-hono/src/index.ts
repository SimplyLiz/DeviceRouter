import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { StorageAdapter } from '@device-router/storage';
import type { TierThresholds, FallbackProfile } from '@device-router/types';
import { validateThresholds } from '@device-router/types';
import type { Context } from 'hono';
import { createMiddleware } from './middleware.js';
import { createProbeEndpoint } from './endpoint.js';
import { createInjectionMiddleware } from './inject.js';

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
  probeNonce?: string | ((c: Context) => string);
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

  if (thresholds) validateThresholds(thresholds);

  const result: {
    middleware: ReturnType<typeof createMiddleware>;
    probeEndpoint: ReturnType<typeof createProbeEndpoint>;
    injectionMiddleware?: ReturnType<typeof createInjectionMiddleware>;
  } = {
    middleware: createMiddleware({
      storage,
      cookieName,
      thresholds,
      fallbackProfile,
      classifyFromHeaders,
    }),
    probeEndpoint: createProbeEndpoint({ storage, cookieName, cookiePath, ttl, rejectBots }),
  };

  if (injectProbe) {
    const require = createRequire(import.meta.url);
    const probeBundlePath = require.resolve('@device-router/probe/dist/device-router-probe.min.js');
    let probeScript = readFileSync(probeBundlePath, 'utf-8');

    if (probePath) {
      probeScript = probeScript.replace('"/device-router/probe"', JSON.stringify(probePath));
    }

    result.injectionMiddleware = createInjectionMiddleware({
      probeScript,
      nonce: probeNonce,
    });
  }

  return result;
}

export { createMiddleware } from './middleware.js';
export { createProbeEndpoint } from './endpoint.js';
export { createInjectionMiddleware } from './inject.js';
export type { MiddlewareOptions, DeviceRouterEnv } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
export type { InjectOptions } from './inject.js';
