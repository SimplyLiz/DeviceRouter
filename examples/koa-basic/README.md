# Koa Basic Example

Minimal Koa app demonstrating DeviceRouter.

## Run

```bash
# From the monorepo root
pnpm install
pnpm build

# Start the example
cd examples/koa-basic
pnpm dev
```

Open http://localhost:3000. The probe script runs on page load. Refresh to see your device profile.

## With Redis

```bash
docker compose up -d
```

Then update `server.ts` to use `RedisStorageAdapter` instead of `MemoryStorageAdapter`.
