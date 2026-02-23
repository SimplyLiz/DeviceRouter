# DeviceRouter

[![npm](https://img.shields.io/npm/v/@device-router/types?label=npm&color=cb3837)](https://www.npmjs.com/search?q=%40device-router)
[![CI](https://img.shields.io/github/actions/workflow/status/SimplyLiz/DeviceRouter/ci.yml?branch=main&label=CI)](https://github.com/SimplyLiz/DeviceRouter/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/badge/probe-~1%20KB%20gzipped-blue)](https://github.com/SimplyLiz/DeviceRouter/tree/main/packages/probe)
[![license](https://img.shields.io/github/license/SimplyLiz/DeviceRouter)](https://github.com/SimplyLiz/DeviceRouter/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A520-417e38)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)](https://www.typescriptlang.org/)

**Ship the right experience to every device. Automatically.**

Stop guessing what your users' devices can handle. DeviceRouter detects real device capabilities — CPU cores, memory, network speed, and more — and gives your server the intelligence to adapt responses instantly.

A **~1 KB** client probe. One middleware call. Full device awareness on every request.

## Why DeviceRouter?

Responsive design adapts layout. DeviceRouter adapts **what you serve**.

- A budget phone on 2G? Skip the heavy animations, defer non-critical components, prefer server-side rendering.
- A flagship on fiber? Go all out — autoplay, full interactivity, rich visuals.

No user-agent sniffing. No guesswork. Real signals from real devices, classified into actionable tiers and rendering hints your server can act on immediately.

## How It Works

```
┌──────────┐                  ┌────────────┐     ┌─────────┐
│ Browser  │  POST /probe     │  Express   │     │ Storage │
│ (~1 KB)  │ ──────────────>  │ Middleware │ ──> │         │
│          │  device signals  │            │     │         │
└──────────┘                  └────────────┘     └─────────┘
                                    │
                                    ▼
                            ┌───────────────────┐
                            │ req.deviceProfile │
                            │  tiers + hints    │
                            └───────────────────┘
```

1. **Probe** — A tiny script runs once per session, collecting device signals via browser APIs
2. **Classify** — The middleware classifies the device into CPU, memory, connection, and GPU tiers
3. **Hint** — Rendering hints like `deferHeavyComponents` and `reduceAnimations` are derived automatically
4. **Serve** — Your route handlers read `req.deviceProfile` and respond accordingly

## Quick Start

```bash
pnpm add @device-router/middleware-express @device-router/storage
```

```typescript
import express from 'express';
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = express();
const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.use(express.json());
app.post('/device-router/probe', probeEndpoint);
app.use(middleware);

app.get('/', (req, res) => {
  const profile = req.deviceProfile;

  if (profile?.hints.preferServerRendering) {
    return res.send(renderSSR()); // Full server-rendered page
  }

  if (profile?.hints.deferHeavyComponents) {
    return res.send(renderLite()); // Lightweight shell + lazy loading
  }

  res.send(renderFull()); // Rich interactive experience
});
```

## What Gets Detected

| Signal                 | Source                     | Browser Support       |
| ---------------------- | -------------------------- | --------------------- |
| CPU cores              | `hardwareConcurrency`      | All modern browsers   |
| Device memory          | `deviceMemory`             | Chrome, Edge          |
| Connection type        | `navigator.connection`     | Chrome, Edge          |
| Downlink speed         | `navigator.connection`     | Chrome, Edge          |
| Round-trip time        | `navigator.connection`     | Chrome, Edge          |
| Data saver mode        | `navigator.connection`     | Chrome, Edge          |
| Viewport size          | `window.innerWidth/Height` | All browsers          |
| Pixel ratio            | `devicePixelRatio`         | All browsers          |
| Prefers reduced motion | `matchMedia`               | All modern browsers   |
| Prefers color scheme   | `matchMedia`               | All modern browsers   |
| GPU renderer           | WebGL debug info           | Chrome, Firefox, Edge |
| Battery status         | `navigator.getBattery()`   | Chrome, Edge          |

All signals are optional — the probe gracefully degrades based on what the browser supports.

## Tier Classification

Devices are classified across three dimensions:

| Dimension      | None     | Low               | Mid                         | High/Fast                     |
| -------------- | -------- | ----------------- | --------------------------- | ----------------------------- |
| **CPU**        | —        | 1–2 cores         | 3–4 cores                   | 5+ cores                      |
| **Memory**     | —        | ≤2 GB             | 2–4 GB                      | >4 GB                         |
| **Connection** | —        | 2G                | 3G / slow 4G                | Fast 4G+ (≥5 Mbps)            |
| **GPU**        | No WebGL | Software renderer | Integrated / older discrete | RTX, RX 5000+, Apple M-series |

## Rendering Hints

Based on tiers and user preferences, DeviceRouter derives actionable booleans:

| Hint                    | When it activates                                      |
| ----------------------- | ------------------------------------------------------ |
| `deferHeavyComponents`  | Low-end device, slow connection, or low battery        |
| `serveMinimalCSS`       | Low-end device                                         |
| `reduceAnimations`      | Low-end device, prefers reduced motion, or low battery |
| `useImagePlaceholders`  | Slow connection (2G/3G)                                |
| `disableAutoplay`       | Low-end device, slow connection, or low battery        |
| `preferServerRendering` | Low-end device                                         |
| `disable3dEffects`      | No GPU or software renderer                            |

## Custom Thresholds

Override the default tier boundaries to match your application's needs:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  thresholds: {
    cpu: { lowUpperBound: 4, midUpperBound: 8 },
    memory: { midUpperBound: 8 },
  },
});
```

## Probe Auto-Injection

Automatically inject the probe script into HTML responses:

```typescript
// pnpm add @device-router/probe
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
  probeNonce: 'my-csp-nonce', // optional CSP nonce
});

// Register injectionMiddleware before your routes
```

No need to manually add `<script>` tags — the probe is injected before `</head>` in every HTML response.

## First-Request Handling

By default, `deviceProfile` is `null` on the first page load before the probe runs. Two opt-in strategies provide immediate classification:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  // Option 1: Classify from User-Agent + Client Hints headers
  classifyFromHeaders: true,
  // Option 2: Fall back to preset defaults
  fallbackProfile: 'conservative', // or 'optimistic' or custom DeviceTiers
});
```

When `classifyFromHeaders` is enabled, mobile/tablet/desktop detection happens from the UA string, and Chromium Client Hints (`Device-Memory`, `Save-Data`) refine the result. Check `profile.source` to know the origin: `'probe'`, `'headers'`, or `'fallback'`.

See [Getting Started — First-Request Handling](docs/getting-started.md#first-request-handling) for details.

## Packages

| Package                                                               | Description                                           | Size              |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------- |
| [`@device-router/probe`](docs/api/probe.md)                           | Client-side capability probe                          | **~1 KB** gzipped |
| [`@device-router/types`](docs/api/types.md)                           | Type definitions, classification, and hint derivation | —                 |
| [`@device-router/storage`](docs/api/storage.md)                       | Storage adapters (in-memory + Redis)                  | —                 |
| [`@device-router/middleware-express`](docs/api/middleware-express.md) | Express middleware                                    | —                 |
| [`@device-router/middleware-fastify`](docs/api/middleware-fastify.md) | Fastify plugin                                        | —                 |
| [`@device-router/middleware-hono`](docs/api/middleware-hono.md)       | Hono middleware (edge-compatible)                     | —                 |
| [`@device-router/middleware-koa`](docs/api/middleware-koa.md)         | Koa middleware                                        | —                 |

## Storage

**Development** — In-memory with automatic TTL expiration:

```typescript
import { MemoryStorageAdapter } from '@device-router/storage';
new MemoryStorageAdapter();
```

**Production** — Redis for multi-process / multi-server deployments:

```typescript
import { RedisStorageAdapter } from '@device-router/storage';
new RedisStorageAdapter(redisClient, { prefix: 'dr:profile:' });
```

## Example Apps

Each framework has an example app that renders a product landing page adapting in real time to device capabilities:

- **Full experience** (high-end device) — animated gradient hero, SVG icons, inline charts, pulsing CTA, hover transitions, autoplay visualizer
- **Lite experience** (low-end device) — flat solid backgrounds, Unicode icons, placeholder boxes, no animations, autoplay disabled

Run any example to see it in action:

```bash
pnpm install && pnpm build
cd examples/express-basic
pnpm dev
```

Open http://localhost:3000 — the probe runs on first load, refresh to see your detected profile. Use `?force=lite` or `?force=full` to preview each mode without a real device.

| Framework | Guide                                                       | Example                                  |
| --------- | ----------------------------------------------------------- | ---------------------------------------- |
| Express   | [Quick Start](docs/getting-started.md#quick-start--express) | [express-basic](examples/express-basic/) |
| Fastify   | [Quick Start](docs/getting-started.md#quick-start--fastify) | [fastify-basic](examples/fastify-basic/) |
| Hono      | [Quick Start](docs/getting-started.md#quick-start--hono)    | [hono-basic](examples/hono-basic/)       |
| Koa       | [Quick Start](docs/getting-started.md#quick-start--koa)     | [koa-basic](examples/koa-basic/)         |

## Documentation

- [Getting Started](docs/getting-started.md)
- [Profile Schema Reference](docs/profile-schema.md)
- API Reference: [types](docs/api/types.md) | [probe](docs/api/probe.md) | [storage](docs/api/storage.md) | [express](docs/api/middleware-express.md) | [fastify](docs/api/middleware-fastify.md) | [hono](docs/api/middleware-hono.md) | [koa](docs/api/middleware-koa.md)

## Development

```bash
git clone <repo-url>
cd DeviceRouter
pnpm install
pnpm build
pnpm test
```

## License

MIT
