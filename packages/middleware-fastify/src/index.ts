import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import type { StorageAdapter } from '@device-router/storage';
import type { TierThresholds, FallbackProfile, OnEventCallback } from '@device-router/types';
import { createProbeHealthCheck } from '@device-router/types';
import type { FastifyRequest, FastifyReply } from 'fastify';
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

  const isNonProd = process.env.NODE_ENV !== 'production';
  const effectiveProbePath = probePath ?? '/device-router/probe';

  if (isNonProd) {
    console.info(`[DeviceRouter] Probe endpoint expected at POST ${effectiveProbePath}`);
  }

  const health = isNonProd
    ? createProbeHealthCheck({ onEvent, probePath: effectiveProbePath })
    : null;

  const rawHook = createMiddleware({
    storage,
    cookieName,
    thresholds,
    fallbackProfile,
    classifyFromHeaders,
    onEvent,
  });

  const hook = health
    ? async (req: FastifyRequest, reply: FastifyReply) => {
        health.onMiddlewareHit();
        return rawHook(req, reply);
      }
    : rawHook;

  let injectionMiddleware: ReturnType<typeof createInjectionMiddleware> | undefined;

  if (injectProbe) {
    injectionMiddleware = createInjectionMiddleware({
      probeScript: loadProbeScript({ probePath }),
      nonce: probeNonce,
    });
  }

  const rawEndpoint = createProbeEndpoint({
    storage,
    cookieName,
    cookiePath,
    cookieSecure,
    ttl,
    rejectBots,
    onEvent,
  });

  return {
    middleware: hook,
    probeEndpoint: health
      ? async (req: FastifyRequest, reply: FastifyReply) => {
          health.onProbeReceived();
          return rawEndpoint(req, reply);
        }
      : rawEndpoint,
    injectionMiddleware,
  };
}

export function loadProbeScript(options?: { probePath?: string }): string {
  const require = createRequire(import.meta.url);
  const bundlePath = require.resolve('@device-router/probe/dist/device-router-probe.min.js');
  let script = readFileSync(bundlePath, 'utf-8');
  if (options?.probePath) {
    script = script.replace('"/device-router/probe"', JSON.stringify(options.probePath));
  }
  return script;
}

export { createMiddleware } from './middleware.js';
export { createProbeEndpoint } from './endpoint.js';
export { createInjectionMiddleware } from './inject.js';
export type { MiddlewareOptions } from './middleware.js';
export type { EndpointOptions } from './endpoint.js';
export type { InjectOptions } from './inject.js';
