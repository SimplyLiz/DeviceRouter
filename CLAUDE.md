# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install             # Install dependencies (uses frozen lockfile in CI)
pnpm build               # Build all packages (tsc -b per package, esbuild for probe bundle)
pnpm test                # Run Vitest once with coverage
pnpm test:watch          # Run Vitest in watch mode
pnpm test:coverage       # Run tests with explicit coverage report
pnpm lint                # ESLint check
pnpm format              # Prettier write
pnpm format:check        # Prettier check
pnpm clean               # Remove all dist/ and build artifacts
```

To run a single test file:

```bash
pnpm vitest run packages/types/src/__tests__/classify.test.ts
```

## Architecture

DeviceRouter is a pnpm monorepo that detects real device capabilities server-side and derives rendering hints. A tiny client probe collects browser signals, posts them to a middleware endpoint, and subsequent requests get a classified device profile attached.

### Package dependency graph

```
@device-router/types        ← Core: types, classify(), deriveHints(), validation
       ↑
       ├── @device-router/probe     ← Client-side signal collection (~1 KB gzipped, enforced in CI)
       ├── @device-router/storage   ← StorageAdapter interface + MemoryStorage / RedisStorage
       └── middleware-{express,fastify,hono,koa}  ← Framework adapters (all depend on types + storage)
```

### Middleware packages follow an identical pattern

Each middleware package exports a factory `createDeviceRouter(options)` that produces three pieces:

1. **middleware** — reads session cookie → retrieves profile from storage → classifies + derives hints → attaches to request
2. **endpoint** — `POST /device-router/probe` handler: validates payload, stores profile, sets cookie
3. **inject** — intercepts HTML responses and injects the minified probe script before `</head>` (supports CSP nonce)

### Key flows

- `collectSignals()` (probe) → POST to endpoint → `isValidSignals()` + `classify()` + `deriveHints()` (types) → store via `StorageAdapter` → attach `ClassifiedProfile` to request on next hit

## Code Conventions

- **TypeScript:** ES2022 target, strict mode, Node16 module resolution, ESM throughout
- **Unused params** must be prefixed with `_` (ESLint enforced)
- **Prettier:** 100 char width, 2-space indent, single quotes, trailing commas, semicolons
- **Tests:** Vitest, files in `src/__tests__/*.test.ts`, 80% coverage threshold (branches/functions/lines/statements)
- **Probe size budget:** must be ≤ 1 KB gzipped (checked in CI via `packages/probe/scripts/bundle.js`)
- **Node version:** ≥20 (.nvmrc: v20)
- **No author/co-author attribution** in commits, code, or docs
