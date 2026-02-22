# Changelog

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
