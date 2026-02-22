# DeviceRouter

**Ship the right experience to every device. Automatically.**

Stop guessing what your users' devices can handle. DeviceRouter detects real device capabilities — CPU cores, memory, network speed, and more — and gives your server the intelligence to adapt responses instantly.

A **762-byte** client probe. One middleware call. Full device awareness on every request.

## Why DeviceRouter?

Responsive design adapts layout. DeviceRouter adapts **what you serve**.

- A budget phone on 2G? Skip the heavy animations, defer non-critical components, prefer server-side rendering.
- A flagship on fiber? Go all out — autoplay, full interactivity, rich visuals.

No user-agent sniffing. No guesswork. Real signals from real devices, classified into actionable tiers and rendering hints your server can act on immediately.

## How It Works

```
┌─────────┐    POST /probe     ┌──────────────┐     ┌─────────┐
│ Browser  │ ────────────────> │    Express    │ ──> │ Storage │
│ (762 B)  │   device signals  │  Middleware   │     │         │
└─────────┘                   └──────────────┘     └─────────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │req.deviceProfile│
                              │ tiers + hints │
                              └──────────────┘
```

1. **Probe** — A tiny script runs once per session, collecting device signals via browser APIs
2. **Classify** — The middleware classifies the device into CPU, memory, and connection tiers
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

| Signal                 | Source                     | Browser Support     |
| ---------------------- | -------------------------- | ------------------- |
| CPU cores              | `hardwareConcurrency`      | All modern browsers |
| Device memory          | `deviceMemory`             | Chrome, Edge        |
| Connection type        | `navigator.connection`     | Chrome, Edge        |
| Downlink speed         | `navigator.connection`     | Chrome, Edge        |
| Round-trip time        | `navigator.connection`     | Chrome, Edge        |
| Data saver mode        | `navigator.connection`     | Chrome, Edge        |
| Viewport size          | `window.innerWidth/Height` | All browsers        |
| Pixel ratio            | `devicePixelRatio`         | All browsers        |
| Prefers reduced motion | `matchMedia`               | All modern browsers |
| Prefers color scheme   | `matchMedia`               | All modern browsers |

All signals are optional — the probe gracefully degrades based on what the browser supports.

## Tier Classification

Devices are classified across three dimensions:

| Dimension      | Low       | Mid          | High/Fast          |
| -------------- | --------- | ------------ | ------------------ |
| **CPU**        | 1–2 cores | 3–4 cores    | 5+ cores           |
| **Memory**     | ≤2 GB     | 2–4 GB       | >4 GB              |
| **Connection** | 2G        | 3G / slow 4G | Fast 4G+ (≥5 Mbps) |

## Rendering Hints

Based on tiers and user preferences, DeviceRouter derives actionable booleans:

| Hint                    | When it activates                             |
| ----------------------- | --------------------------------------------- |
| `deferHeavyComponents`  | Low-end device or slow connection             |
| `serveMinimalCSS`       | Low-end device                                |
| `reduceAnimations`      | Low-end device or user prefers reduced motion |
| `useImagePlaceholders`  | Slow connection (2G/3G)                       |
| `disableAutoplay`       | Low-end device or slow connection             |
| `preferServerRendering` | Low-end device                                |

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

## Packages

| Package                                                               | Description                                           | Size              |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------- |
| [`@device-router/probe`](docs/api/probe.md)                           | Client-side capability probe                          | **762 B** gzipped |
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

## Framework Quick Start

- [Express](docs/getting-started.md#quick-start--express) | [Example](examples/express-basic/)
- [Fastify](docs/getting-started.md#quick-start--fastify) | [Example](examples/fastify-basic/)
- [Hono](docs/getting-started.md#quick-start--hono) | [Example](examples/hono-basic/)
- [Koa](docs/getting-started.md#quick-start--koa) | [Example](examples/koa-basic/)

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
