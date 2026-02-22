# Changelog

## 0.1.0 (2026-02-22)

Initial release.

### Features

- **@device-router/types** — Device profile types, tier classification (cpu/memory/connection), rendering hints
- **@device-router/probe** — Client-side capability probe (<1 KB gzipped) collecting device signals via browser APIs
- **@device-router/storage** — Storage adapters: in-memory (dev) and Redis (production)
- **@device-router/middleware-express** — Express middleware and probe endpoint with `createDeviceRouter()` factory
