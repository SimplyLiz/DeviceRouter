/**
 * E2E smoke test for all @device-router/* packages.
 *
 * Installs packages from local tarballs (exactly what npm publish ships)
 * and exercises every public export as a real consumer would.
 *
 * Catches: broken exports maps, missing dist files, ESM resolution failures,
 * cross-package dependency issues, and runtime import errors.
 */

// ---------------------------------------------------------------------------
// Imports — every public export across all packages
// ---------------------------------------------------------------------------

// @device-router/types
import {
  classify,
  classifyCpu,
  classifyMemory,
  classifyConnection,
  classifyGpu,
  deriveHints,
  isValidSignals,
  validateThresholds,
  isBotSignals,
  classifyFromHeaders,
  resolveFallback,
  emitEvent,
  extractErrorMessage,
  createProbeHealthCheck,
  ACCEPT_CH_VALUE,
  CONSERVATIVE_TIERS,
  OPTIMISTIC_TIERS,
  DEFAULT_CPU_THRESHOLDS,
  DEFAULT_MEMORY_THRESHOLDS,
  DEFAULT_CONNECTION_THRESHOLDS,
  DEFAULT_GPU_THRESHOLDS,
  NO_PROBE_DATA_THRESHOLD,
} from '@device-router/types';

// @device-router/probe
import { collectSignals, runProbe, runProbeWithRetry } from '@device-router/probe';

// @device-router/storage
import { MemoryStorageAdapter, RedisStorageAdapter } from '@device-router/storage';

// @device-router/middleware-express
import {
  createDeviceRouter as createExpressRouter,
  loadProbeScript as loadExpressProbe,
  createMiddleware as createExpressMw,
  createProbeEndpoint as createExpressEndpoint,
  createInjectionMiddleware as createExpressInject,
} from '@device-router/middleware-express';

// @device-router/middleware-fastify
import {
  createDeviceRouter as createFastifyRouter,
  loadProbeScript as loadFastifyProbe,
  createMiddleware as createFastifyMw,
  createProbeEndpoint as createFastifyEndpoint,
  createInjectionMiddleware as createFastifyInject,
} from '@device-router/middleware-fastify';

// @device-router/middleware-hono
import {
  createDeviceRouter as createHonoRouter,
  loadProbeScript as loadHonoProbe,
  createMiddleware as createHonoMw,
  createProbeEndpoint as createHonoEndpoint,
  createInjectionMiddleware as createHonoInject,
} from '@device-router/middleware-hono';

// @device-router/middleware-koa
import {
  createDeviceRouter as createKoaRouter,
  loadProbeScript as loadKoaProbe,
  createMiddleware as createKoaMw,
  createProbeEndpoint as createKoaEndpoint,
  createInjectionMiddleware as createKoaInject,
} from '@device-router/middleware-koa';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const validSignals = {
  hardwareConcurrency: 8,
  deviceMemory: 8,
  viewport: { width: 1920, height: 1080 },
  connection: { downlink: 10, rtt: 50, effectiveType: '4g', saveData: false },
  gpu: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce RTX 3080)' },
  timestamp: Date.now(),
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    console.error(`  \u2717 ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('1. @device-router/types — classify()');
{
  const tiers = classify(validSignals);
  assert(typeof tiers.cpu === 'string', `cpu tier: ${tiers.cpu}`);
  assert(typeof tiers.memory === 'string', `memory tier: ${tiers.memory}`);
  assert(typeof tiers.connection === 'string', `connection tier: ${tiers.connection}`);
  assert(typeof tiers.gpu === 'string', `gpu tier: ${tiers.gpu}`);
}

console.log('\n2. @device-router/types — individual classifiers');
{
  assert(typeof classifyCpu(8) === 'string', 'classifyCpu');
  assert(typeof classifyMemory(8) === 'string', 'classifyMemory');
  assert(
    typeof classifyConnection({ downlink: 10, rtt: 50, effectiveType: '4g', saveData: false }) ===
      'string',
    'classifyConnection',
  );
  assert(typeof classifyGpu('ANGLE (NVIDIA GeForce RTX 3080)') === 'string', 'classifyGpu');
}

console.log('\n3. @device-router/types — deriveHints()');
{
  const tiers = classify(validSignals);
  const hints = deriveHints(tiers);
  assert(
    typeof hints.deferHeavyComponents === 'boolean',
    `deferHeavyComponents: ${hints.deferHeavyComponents}`,
  );
  assert(
    typeof hints.reduceAnimations === 'boolean',
    `reduceAnimations: ${hints.reduceAnimations}`,
  );
  assert(
    typeof hints.limitVideoQuality === 'boolean',
    `limitVideoQuality: ${hints.limitVideoQuality}`,
  );
  assert(typeof hints.serveMinimalCSS === 'boolean', `serveMinimalCSS: ${hints.serveMinimalCSS}`);
  assert(
    typeof hints.disable3dEffects === 'boolean',
    `disable3dEffects: ${hints.disable3dEffects}`,
  );
  assert(
    typeof hints.useImagePlaceholders === 'boolean',
    `useImagePlaceholders: ${hints.useImagePlaceholders}`,
  );
  assert(
    typeof hints.preferServerRendering === 'boolean',
    `preferServerRendering: ${hints.preferServerRendering}`,
  );
  assert(typeof hints.useSystemFonts === 'boolean', `useSystemFonts: ${hints.useSystemFonts}`);
  assert(typeof hints.disablePrefetch === 'boolean', `disablePrefetch: ${hints.disablePrefetch}`);
}

console.log('\n4. @device-router/types — validation');
{
  assert(isValidSignals(validSignals) === true, 'valid signals pass');
  assert(isValidSignals(null) === false, 'null fails');
  assert(isValidSignals('string') === false, 'string fails');
  assert(isValidSignals({ hardwareConcurrency: 'not-a-number' }) === false, 'wrong type fails');
  // validateThresholds throws on invalid, returns void on valid
  let threw = false;
  try {
    validateThresholds({ cpu: { lowUpperBound: -1, midUpperBound: 4 } });
  } catch {
    threw = true;
  }
  assert(threw, 'validateThresholds throws on invalid');
  let valid = true;
  try {
    validateThresholds({ cpu: DEFAULT_CPU_THRESHOLDS });
  } catch {
    valid = false;
  }
  assert(valid, 'validateThresholds accepts valid thresholds');
}

console.log('\n5. @device-router/types — bot detection');
{
  assert(typeof isBotSignals === 'function', 'isBotSignals exported');
  assert(isBotSignals(validSignals) === false, 'normal signals not bot');
}

console.log('\n6. @device-router/types — header classification');
{
  assert(typeof classifyFromHeaders === 'function', 'classifyFromHeaders exported');
  assert(typeof resolveFallback === 'function', 'resolveFallback exported');
  assert(typeof ACCEPT_CH_VALUE === 'string', `ACCEPT_CH_VALUE: ${ACCEPT_CH_VALUE}`);
}

console.log('\n7. @device-router/types — constants');
{
  assert(typeof CONSERVATIVE_TIERS === 'object', 'CONSERVATIVE_TIERS exported');
  assert(typeof OPTIMISTIC_TIERS === 'object', 'OPTIMISTIC_TIERS exported');
  assert(typeof DEFAULT_CPU_THRESHOLDS === 'object', 'DEFAULT_CPU_THRESHOLDS exported');
  assert(typeof DEFAULT_MEMORY_THRESHOLDS === 'object', 'DEFAULT_MEMORY_THRESHOLDS exported');
  assert(
    typeof DEFAULT_CONNECTION_THRESHOLDS === 'object',
    'DEFAULT_CONNECTION_THRESHOLDS exported',
  );
  assert(typeof DEFAULT_GPU_THRESHOLDS === 'object', 'DEFAULT_GPU_THRESHOLDS exported');
  assert(
    typeof NO_PROBE_DATA_THRESHOLD === 'number',
    `NO_PROBE_DATA_THRESHOLD: ${NO_PROBE_DATA_THRESHOLD}`,
  );
}

console.log('\n8. @device-router/types — events');
{
  assert(typeof emitEvent === 'function', 'emitEvent exported');
  assert(typeof extractErrorMessage === 'function', 'extractErrorMessage exported');
  assert(typeof createProbeHealthCheck === 'function', 'createProbeHealthCheck exported');
}

console.log('\n9. @device-router/probe — exports');
{
  assert(typeof collectSignals === 'function', 'collectSignals exported');
  assert(typeof runProbe === 'function', 'runProbe exported');
  assert(typeof runProbeWithRetry === 'function', 'runProbeWithRetry exported');
}

console.log('\n10. @device-router/storage — MemoryStorageAdapter');
{
  const storage = new MemoryStorageAdapter();
  const profile = {
    tiers: classify(validSignals),
    hints: deriveHints(classify(validSignals)),
    signals: validSignals,
  };
  await storage.set('test-session', profile);
  const retrieved = await storage.get('test-session');
  assert(retrieved !== null, 'profile retrieved from memory');
  assert(retrieved.tiers.cpu === profile.tiers.cpu, 'cpu tier matches after storage round-trip');
  assert(
    retrieved.hints.reduceAnimations === profile.hints.reduceAnimations,
    'hints match after storage round-trip',
  );
  await storage.delete('test-session');
  const deleted = await storage.get('test-session');
  assert(deleted === null, 'profile deleted successfully');
}

console.log('\n11. @device-router/storage — RedisStorageAdapter');
{
  assert(typeof RedisStorageAdapter === 'function', 'RedisStorageAdapter exported');
}

console.log('\n12. @device-router/storage — cross-package dependency');
{
  // Storage depends on types. Verify the dependency resolution works:
  // classify() from types produces data that storage can persist
  const tiers = classify(validSignals);
  const hints = deriveHints(tiers);
  const store = new MemoryStorageAdapter();
  const profile = { tiers, hints, signals: validSignals };
  await store.set('cross-pkg', profile);
  const got = await store.get('cross-pkg');
  assert(got.tiers.cpu === tiers.cpu, 'types -> storage dependency works');
}

console.log('\n13. @device-router/middleware-express — exports');
{
  assert(typeof createExpressRouter === 'function', 'createDeviceRouter');
  assert(typeof loadExpressProbe === 'function', 'loadProbeScript');
  assert(typeof createExpressMw === 'function', 'createMiddleware');
  assert(typeof createExpressEndpoint === 'function', 'createProbeEndpoint');
  assert(typeof createExpressInject === 'function', 'createInjectionMiddleware');
}

console.log('\n14. @device-router/middleware-express — factory');
{
  const storage = new MemoryStorageAdapter();
  const { middleware, probeEndpoint } = createExpressRouter({ storage });
  assert(typeof middleware === 'function', 'middleware is a function');
  assert(typeof probeEndpoint === 'function', 'probeEndpoint is a function');
}

console.log('\n15. @device-router/middleware-express — loadProbeScript');
{
  const script = loadExpressProbe();
  assert(
    typeof script === 'string' && script.length > 0,
    `probe script loaded (${script.length} chars)`,
  );
}

console.log('\n16. @device-router/middleware-fastify — exports + factory');
{
  assert(typeof createFastifyRouter === 'function', 'createDeviceRouter');
  assert(typeof loadFastifyProbe === 'function', 'loadProbeScript');
  assert(typeof createFastifyMw === 'function', 'createMiddleware');
  assert(typeof createFastifyEndpoint === 'function', 'createProbeEndpoint');
  assert(typeof createFastifyInject === 'function', 'createInjectionMiddleware');

  const storage = new MemoryStorageAdapter();
  const { middleware, probeEndpoint } = createFastifyRouter({ storage });
  assert(typeof middleware === 'function', 'factory produces middleware');
  assert(typeof probeEndpoint === 'function', 'factory produces probeEndpoint');
}

console.log('\n17. @device-router/middleware-hono — exports + factory');
{
  assert(typeof createHonoRouter === 'function', 'createDeviceRouter');
  assert(typeof loadHonoProbe === 'function', 'loadProbeScript');
  assert(typeof createHonoMw === 'function', 'createMiddleware');
  assert(typeof createHonoEndpoint === 'function', 'createProbeEndpoint');
  assert(typeof createHonoInject === 'function', 'createInjectionMiddleware');

  const storage = new MemoryStorageAdapter();
  const { middleware, probeEndpoint } = createHonoRouter({ storage });
  assert(typeof middleware === 'function', 'factory produces middleware');
  assert(typeof probeEndpoint === 'function', 'factory produces probeEndpoint');
}

console.log('\n18. @device-router/middleware-koa — exports + factory');
{
  assert(typeof createKoaRouter === 'function', 'createDeviceRouter');
  assert(typeof loadKoaProbe === 'function', 'loadProbeScript');
  assert(typeof createKoaMw === 'function', 'createMiddleware');
  assert(typeof createKoaEndpoint === 'function', 'createProbeEndpoint');
  assert(typeof createKoaInject === 'function', 'createInjectionMiddleware');

  const storage = new MemoryStorageAdapter();
  const { middleware, probeEndpoint } = createKoaRouter({ storage });
  assert(typeof middleware === 'function', 'factory produces middleware');
  assert(typeof probeEndpoint === 'function', 'factory produces probeEndpoint');
}

console.log('\n19. Cross-package: types -> storage -> middleware');
{
  // Full chain: classify signals, store profile, middleware factory works with shared storage
  const tiers = classify(validSignals);
  const hints = deriveHints(tiers);
  const storage = new MemoryStorageAdapter();
  await storage.set('full-chain', { tiers, hints, signals: validSignals });

  // All four middleware packages can use the same storage instance
  const expr = createExpressRouter({ storage });
  const fast = createFastifyRouter({ storage });
  const hono = createHonoRouter({ storage });
  const koa = createKoaRouter({ storage });

  assert(typeof expr.middleware === 'function', 'express middleware with shared storage');
  assert(typeof fast.middleware === 'function', 'fastify middleware with shared storage');
  assert(typeof hono.middleware === 'function', 'hono middleware with shared storage');
  assert(typeof koa.middleware === 'function', 'koa middleware with shared storage');

  // Verify storage still works after middleware setup
  const got = await storage.get('full-chain');
  assert(got.tiers.cpu === tiers.cpu, 'storage data intact after middleware setup');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) {
  process.exit(1);
}
