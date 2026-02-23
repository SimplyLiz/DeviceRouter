# Changelog

## Unreleased

### Documentation

- **Deployment guide** — New `docs/deployment.md` covering Docker (Node.js + Redis), Cloudflare Workers (Hono + KV), and serverless platforms (Lambda, Vercel). Includes Dockerfiles, docker-compose, custom StorageAdapter examples for edge runtimes, and production checklists

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
- **Battery API signal** — Collect battery level and charging status via `navigator.getBattery()` (Chromium-only, silently skipped elsewhere). When unplugged and below 15%, `deferHeavyComponents`, `reduceAnimations`, and `disableAutoplay` are forced on
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
