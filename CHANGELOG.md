# Changelog

## Unreleased

### Breaking Changes

- **Rename `ConnectionTier` value `'fast'` → `'high'`** — Aligns connection tier vocabulary with CPU, memory, and GPU tiers which all use `'low' | 'mid' | 'high'`. Update any code comparing `tiers.connection === 'fast'` to use `'high'` instead
- **`classify()` and `deriveHints()` now accept `StoredSignals` instead of `RawSignals`** — These functions never used `userAgent` or `viewport` (which are stripped before storage). The narrower type makes the API honest. Existing call sites are unaffected — `RawSignals` is structurally assignable to `StoredSignals`
- **`profile:store` event now carries `StoredSignals` instead of `RawSignals`** — The event previously emitted the raw probe payload (including `userAgent`/`viewport`), not what was actually stored. The `signals` field now matches the persisted data. `bot:reject` still carries `RawSignals` (it fires before stripping)
- **Rename default cookie `dr_session` → `device-router-session`** — Self-documenting name before 1.0 locks the cookie in. If you hardcode `cookieName: 'dr_session'` in your options you are unaffected; if you rely on the default, existing sessions will reset once on deploy
- **Remove `disableAutoplay` rendering hint** — `disableAutoplay` triggered on identical conditions to `deferHeavyComponents` (`isLowEnd || isSlowConnection || isBatteryConstrained`). Use `deferHeavyComponents` instead
- **middleware-fastify: normalized return shape** — `createDeviceRouter()` now returns raw Fastify hooks instead of a `fastify-plugin` wrapped plugin. Migrate `await app.register(middleware)` → `app.addHook('preHandler', middleware)`. When using `injectProbe: true`, register the injection hook separately: `app.addHook('onSend', injectionMiddleware)`. Removed `fastify-plugin` dependency

### Features

- **Composable middleware** — `createMiddleware()`, `createProbeEndpoint()`, and `createInjectionMiddleware()` are now first-class exports with full threshold validation and documentation. Use them independently for fine-grained control without the `createDeviceRouter()` factory
- **`loadProbeScript()` utility** — New helper exported from all middleware packages that reads the minified probe bundle and optionally rewrites the endpoint URL. Pairs with `createInjectionMiddleware()` for standalone probe injection

## 0.4.0 (2026-02-24)

### Features

- **Observability hooks** — New `onEvent` callback option on all middleware packages. Emits `profile:classify`, `profile:store`, `bot:reject`, and `error` events for plugging in logging, metrics, and monitoring without middleware wrapping. Callbacks are fire-and-forget with built-in error isolation

### Documentation

- **Observability example** — New `examples/observability/` with Docker Compose stack (Express + Redis + Prometheus + Grafana), all 6 Prometheus metrics wired to `onEvent`, and a pre-built Grafana dashboard. Adds `device_router_hint_total` metric for tracking hint activation rates
- **Meta-framework integration guide** — New `docs/meta-frameworks.md` covering Next.js (App Router), Remix, and SvelteKit integration using `classifyFromHeaders` and `deriveHints` directly from `@device-router/types`
- **Client Hints browser compatibility** — Added browser compatibility table to the Getting Started guide documenting which Client Hints headers are available on Chrome, Edge, Safari, and Firefox, and what happens when headers are missing
- **Rate limiting** — Added production checklist note that the probe endpoint has no built-in rate limiting and should be protected via reverse proxy or framework-level rate limiter
- **Threshold staleness fix** — Corrected deployment guide: threshold changes take effect immediately since classification runs on every request. Removed misleading flush/TTL/cookie-rotation mitigation strategies

## 0.3.0 (2026-02-23)

### Breaking Changes

- **userAgent and viewport stripped from stored profiles** — `userAgent` and `viewport` are no longer persisted in device profiles. They are still collected by the probe and used for bot/crawler filtering at the endpoint, but stripped before storage. Stored `RawSignals` no longer contain `userAgent` or `viewport` fields

### Bug Fixes

- **Redis error handling** — `RedisStorageAdapter` now catches connection failures and corrupted JSON on all methods. `get()`/`exists()` return safe defaults (`null`/`false`), `set()`/`delete()` silently degrade instead of throwing unhandled errors

### Documentation

- **Deployment guide** — New `docs/deployment.md` covering Docker (Node.js + Redis), Cloudflare Workers (Hono + KV), and serverless platforms (Lambda, Vercel). Includes Dockerfiles, docker-compose, custom StorageAdapter examples for edge runtimes, and production checklists
- **Streaming injection limitation** — Documented that probe auto-injection requires a string response body; streaming responses are silently skipped (or buffered on Hono). Added framework-specific notes to all package READMEs and getting-started guide

### Features

- **Secure cookie option** — New `cookieSecure` option on all middleware packages sets the `Secure` flag on the session cookie. Set `cookieSecure: true` for HTTPS deployments
- **Threshold validation** — `createDeviceRouter()` now validates custom thresholds at startup: rejects inverted bounds (e.g. `lowUpperBound >= midUpperBound`), non-positive values, and non-RegExp GPU patterns. Fails fast with descriptive errors instead of silently producing wrong classifications
- **First-request fallback** — Opt-in strategies to provide a classified profile on the very first page load, before the probe has run
- **Header-based classification** — `classifyFromHeaders: true` classifies devices from User-Agent and Client Hints headers (`Sec-CH-UA-Mobile`, `Device-Memory`, `Save-Data`), sets `Accept-CH` response header to request hints from Chromium browsers
- **Fallback profiles** — `fallbackProfile` option accepts `'conservative'` (low-end defaults), `'optimistic'` (high-end defaults), or custom `DeviceTiers`
- **Profile source tracking** — New `source` field on `ClassifiedProfile` indicates origin: `'probe'`, `'headers'`, or `'fallback'`
- **Preset tier constants** — `CONSERVATIVE_TIERS` and `OPTIMISTIC_TIERS` exported from `@device-router/types`
- **Bot/crawler filtering** — Probe endpoints reject bot submissions by default (`rejectBots: true`). New `isBotSignals()` detects bots via UA patterns, headless GPU renderers, and empty signal payloads

## 0.2.0 (2026-02-22)

### Features

- **GPU detection** — Classify GPU tier from WebGL renderer string: software renderers → `low`, RTX/RX 5000+/Apple M-series → `high`, everything else → `mid`
- **Battery API signal** — Collect battery level and charging status via `navigator.getBattery()` (Chromium-only, silently skipped elsewhere). When unplugged and below 15%, `deferHeavyComponents` and `reduceAnimations` are forced on
- **Signal validation** — New `isValidSignals()` type guard for validating incoming probe payloads
- **Custom GPU thresholds** — `softwarePattern` and `highEndPattern` are configurable via `GpuThresholds`

### Dependencies

- Bump `esbuild` from 0.25.12 to 0.27.3
- Bump `koa` and `@types/koa`
- Bump `actions/checkout` from v4 to v6
- Bump `actions/setup-node` from v4 to v6

### Infrastructure

- Split CI into separate lint, audit, and test jobs
- Add Dependabot config for automated dependency updates

## 0.1.0 (2026-02-22)

Initial release.

### Features

- **@device-router/types** — Device profile types, tier classification (cpu/memory/connection), rendering hints
- **@device-router/probe** — Client-side capability probe (<1 KB gzipped) collecting device signals via browser APIs
- **@device-router/storage** — Storage adapters: in-memory (dev) and Redis (production)
- **@device-router/middleware-express** — Express middleware and probe endpoint with `createDeviceRouter()` factory
- **@device-router/middleware-fastify** — Fastify plugin with `preHandler` hook and probe endpoint
- **@device-router/middleware-hono** — Hono middleware (edge-compatible) with probe endpoint
- **@device-router/middleware-koa** — Koa middleware with probe endpoint
- **Custom thresholds** — Override default tier boundaries via `thresholds` option on all adapters
- **Probe auto-injection** — `injectProbe: true` automatically injects the probe `<script>` into HTML responses (all adapters), with CSP nonce support
