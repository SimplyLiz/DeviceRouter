# Getting Started

## Installation

Pick the middleware package for your framework:

```bash
# Express
pnpm add @device-router/middleware-express @device-router/storage

# Fastify
pnpm add @device-router/middleware-fastify @device-router/storage

# Hono
pnpm add @device-router/middleware-hono @device-router/storage

# Koa
pnpm add @device-router/middleware-koa @device-router/storage
```

## Quick Start — Express

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = express();
app.use(cookieParser());
app.use(express.json());

const storage = new MemoryStorageAdapter();
const { middleware, probeEndpoint } = createDeviceRouter({ storage });

app.post('/device-router/probe', probeEndpoint);
app.use(middleware);

app.get('/', (req, res) => {
  const profile = req.deviceProfile;
  if (profile?.tiers.cpu === 'low') {
    res.send('Lightweight page');
  } else {
    res.send('Full experience');
  }
});
```

## Quick Start — Fastify

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createDeviceRouter } from '@device-router/middleware-fastify';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = Fastify();
await app.register(cookie);

const { plugin, pluginOptions, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.post('/device-router/probe', probeEndpoint);
await app.register(plugin, pluginOptions);

app.get('/', (req, reply) => {
  const profile = req.deviceProfile;
  reply.send(profile ? { tier: profile.tiers.cpu } : { tier: null });
});
```

## Quick Start — Hono

```typescript
import { Hono } from 'hono';
import { createDeviceRouter } from '@device-router/middleware-hono';
import type { DeviceRouterEnv } from '@device-router/middleware-hono';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Hono<DeviceRouterEnv>();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.post('/device-router/probe', probeEndpoint);
app.use('*', middleware);

app.get('/', (c) => {
  const profile = c.get('deviceProfile');
  return c.json(profile ? { tier: profile.tiers.cpu } : { tier: null });
});
```

## Quick Start — Koa

```typescript
import Koa from 'koa';
import { createDeviceRouter } from '@device-router/middleware-koa';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Koa();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

// Route probe endpoint
app.use(async (ctx, next) => {
  if (ctx.path === '/device-router/probe' && ctx.method === 'POST') {
    await probeEndpoint(ctx);
    return;
  }
  await next();
});

app.use(middleware);

app.use(async (ctx) => {
  const profile = ctx.state.deviceProfile;
  ctx.body = profile ? { tier: profile.tiers.cpu } : { tier: null };
});
```

## Add the Probe Script

```html
<script src="/path/to/device-router-probe.min.js"></script>
```

The probe script (~988 bytes gzipped) runs once per session. It collects device signals and POSTs them to the probe endpoint.

### Auto-Injection

Instead of manually adding the script tag, enable auto-injection:

```typescript
// Install the probe package
// pnpm add @device-router/probe

const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
});

// Register injectionMiddleware before your routes
```

The probe `<script>` is automatically injected into HTML responses.

## Custom Thresholds

Override the default tier boundaries:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  thresholds: {
    cpu: { lowUpperBound: 4, midUpperBound: 8 },
    memory: { midUpperBound: 8 },
    connection: { downlink4gUpperBound: 10 },
  },
});
```

## Configuration

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,              // Required: StorageAdapter instance
  cookieName: 'dr_session',   // Default: 'dr_session'
  cookiePath: '/',            // Default: '/'
  ttl: 86400,                 // Default: 86400 (24 hours)
  thresholds: { ... },        // Optional: custom tier thresholds
  injectProbe: false,         // Default: false
  probePath: '/device-router/probe',  // Default: '/device-router/probe'
  probeNonce: 'my-nonce',     // Optional: CSP nonce
});
```

## Using Redis Storage

```typescript
import Redis from 'ioredis';
import { RedisStorageAdapter } from '@device-router/storage';

const redis = new Redis();
const storage = new RedisStorageAdapter({
  client: redis,
  keyPrefix: 'dr:profile:', // Default prefix
});
```

## Device Tiers

The middleware classifies devices into tiers based on collected signals:

| Tier | CPU       | Memory | Connection | GPU                           |
| ---- | --------- | ------ | ---------- | ----------------------------- |
| None | —         | —      | —          | No WebGL                      |
| Low  | 1-2 cores | ≤2 GB  | 2g         | Software renderer             |
| Mid  | 3-4 cores | 2-4 GB | 3g, 4g     | Integrated / older discrete   |
| High | 5+ cores  | >4 GB  | fast       | RTX, RX 5000+, Apple M-series |

## Rendering Hints

Based on device tiers, the middleware provides boolean rendering hints:

- `deferHeavyComponents` — Delay loading expensive UI components
- `serveMinimalCSS` — Send reduced stylesheets
- `reduceAnimations` — Disable or simplify animations
- `useImagePlaceholders` — Show placeholders instead of full images
- `disableAutoplay` — Prevent auto-playing media
- `preferServerRendering` — Favor SSR over client-side rendering
- `disable3dEffects` — Disable WebGL/3D content (no GPU or software renderer)
