# Koa Basic Example

Adaptive landing page that renders differently based on detected device capabilities. High-end devices see animated gradients, SVG icons, inline charts, and autoplay. Low-end devices get a flat, lightweight experience with placeholders and no animations.

## Run

```bash
# From the monorepo root
pnpm install
pnpm build

# Start the example
cd examples/koa-basic
pnpm dev
```

Open http://localhost:3000. The probe script runs on first page load — refresh to see your detected device profile and adaptive rendering.

## Preview Modes

Use query params to force a specific experience without needing a real low-end device:

- `?force=full` — full experience (gradients, animations, SVG charts)
- `?force=lite` — lite experience (flat, minimal, no animations)
- `/` — auto-detect from device profile

Toggle links are also rendered at the bottom of the page.

## With Redis

```bash
docker compose up -d
```

Then update `server.ts` to use `RedisStorageAdapter` instead of `MemoryStorageAdapter`.
