import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { StorageAdapter } from '@device-router/storage';
import type { TierThresholds, FallbackProfile } from '@device-router/types';
import { validateThresholds } from '@device-router/types';
import { createMiddleware } from './middleware.js';
import { createProbeEndpoint } from './endpoint.js';
import { createInjectionMiddleware } from './inject.js';

export interface DeviceRouterOptions {
  storage: StorageAdapter;
  cookieName?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  ttl?: number;
  probePath?: string;
  thresholds?: TierThresholds;
  rejectBots?: boolean;
  injectProbe?: boolean;
  probeNonce?: string | ((req: import('express').Request) => string);
  fallbackProfile?: FallbackProfile;
  classifyFromHeaders?: boolean;
}

export function createDeviceRouter(options: DeviceRouterOptions) {
  const {
    storage,
    cookieName = 'dr_session',
    cookiePath = '/',
    cookieSecure,
    ttl = 86400,
    probePath,
    thresholds,
    rejectBots,
    injectProbe = false,
    probeNonce,
    fallbackProfile,
    classifyFromHeaders,
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
    probeEndpoint: createProbeEndpoint({
      storage,
      cookieName,
      cookiePath,
      cookieSecure,
      ttl,
      rejectBots,
    }),
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
export type { MiddlewareOptions } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
export type { InjectOptions } from './inject.js';
