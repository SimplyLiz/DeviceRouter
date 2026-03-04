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

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.post('/device-router/probe', probeEndpoint);
app.addHook('preHandler', middleware);

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

The probe script (~1 KB gzipped) runs once per session. It collects device signals and POSTs them to the probe endpoint.

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

> **Streaming responses:** Auto-injection requires the full response body as a string. If you stream HTML (e.g. React `renderToPipeableStream`), the injection is silently skipped. Add the probe `<script>` tag to your HTML shell manually instead.

## First-Request Handling

By default, `deviceProfile` is `null` on the first page load because the probe hasn't run yet. Two opt-in strategies provide a classified profile immediately:

### Header-based classification

Classify devices from the User-Agent string and Client Hints headers on the first request:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  classifyFromHeaders: true,
});
```

This sets `deviceProfile.source` to `'headers'` on first requests. The middleware also sends an `Accept-CH` response header to request Client Hints from Chromium browsers on subsequent requests. Once the probe runs, `source` becomes `'probe'`.

#### Browser compatibility

`classifyFromHeaders` relies on Client Hints headers that are only available on Chromium-based browsers. Safari and Firefox do not send these headers, so classification falls back to User-Agent string parsing alone.

| Header               | Chrome | Edge | Safari | Firefox |
| -------------------- | ------ | ---- | ------ | ------- |
| `Sec-CH-UA-Mobile`   | Yes    | Yes  | No     | No      |
| `Sec-CH-UA-Platform` | Yes    | Yes  | No     | No      |
| `Device-Memory`      | Yes    | Yes  | No     | No      |
| `Save-Data`          | Yes    | Yes  | No     | No      |

On Safari and Firefox, `classifyFromHeaders` uses only the User-Agent string. This means:

- Mobile vs. desktop detection still works (UA patterns are reliable)
- Memory, connection, and GPU tiers use defaults for the device category (mobile → low, desktop → high)
- No `Device-Memory` refinement and no `Save-Data` detection

**Recommendation:** If you rely on `classifyFromHeaders` for first-request accuracy, combine it with `fallbackProfile: 'conservative'` so non-Chromium browsers get safe defaults rather than potentially optimistic header-only guesses. The probe (which works on all browsers) will refine the profile on the next request.

### Fallback profile

Provide structured defaults instead of `null`:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  fallbackProfile: 'conservative', // or 'optimistic' or custom DeviceTiers
});
```

The `'conservative'` preset assumes a low-end device (low CPU/memory, 3G connection). The `'optimistic'` preset assumes a high-end device.

### Combining both

When both are set, `classifyFromHeaders` takes priority:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  classifyFromHeaders: true,
  fallbackProfile: 'conservative', // used if header classification is disabled
});
```

### Checking the profile source

Use the `source` field to know where the profile came from:

```typescript
const profile = req.deviceProfile;
if (profile?.source === 'probe') {
  // Full accuracy — real device signals
} else if (profile?.source === 'headers') {
  // Best-effort from UA/Client Hints
} else if (profile?.source === 'fallback') {
  // Configured defaults
}
```

## Observability

Pass an `onEvent` callback to receive events for classification, storage, bot rejection, and errors:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  onEvent: (event) => {
    console.log(`[device-router] ${event.type}`, event);
  },
});
```

See the [Observability guide](observability.md) for structured logging and Prometheus examples.

## Custom Thresholds

Override the default tier boundaries:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  thresholds: {
    cpu: { lowUpperBound: 4, midUpperBound: 8 },
    memory: { midUpperBound: 8 },
    connection: { highUpperBound: 10 },
  },
});
```

Thresholds are validated at startup — inverted bounds, non-positive values, or non-RegExp GPU patterns throw immediately with a descriptive error. Partial thresholds are merged with defaults before validation, so ordering is checked against the full resolved config.

> **Note:** Changing thresholds does not re-classify profiles already stored from a previous deploy. See [Profile versioning](deployment.md#profile-versioning) in the Deployment Guide for strategies to handle threshold changes.

## Configuration

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,              // Required: StorageAdapter instance
  cookieName: 'device-router-session',   // Default: 'device-router-session'
  cookiePath: '/',            // Default: '/'
  cookieSecure: false,        // Default: false — set to true for HTTPS deployments
  ttl: 86400,                 // Default: 86400 (24 hours)
  rejectBots: true,           // Default: true — reject bot/crawler probes
  thresholds: { ... },        // Optional: custom tier thresholds
  injectProbe: false,         // Default: false
  probePath: '/device-router/probe',  // Default: '/device-router/probe'
  probeNonce: 'my-nonce',     // Optional: CSP nonce
  classifyFromHeaders: false, // Default: false — classify from UA/Client Hints
  fallbackProfile: undefined, // Optional: 'conservative', 'optimistic', or custom DeviceTiers
});
```

### Production: enable Secure cookies

When deploying over HTTPS, set `cookieSecure: true` so the session cookie is never sent over plain HTTP:

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  cookieSecure: true,
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

## Privacy and Cookie Consent

DeviceRouter collects device capability signals and links them to a session cookie. Depending on your jurisdiction (EU, UK, California, Brazil, and others), this has regulatory implications — you may need to obtain user consent before loading the probe script.

For a full signal inventory, fingerprinting risk assessment, cookie details, consent integration examples, and jurisdiction-specific guidance, see the [Privacy Guide](privacy.md).

> **Note:** This section is informational guidance, not legal advice. Consult a qualified privacy professional for your specific deployment.

## Device Tiers

The middleware classifies devices into tiers based on collected signals:

| Tier | CPU       | Memory | Connection | GPU                           |
| ---- | --------- | ------ | ---------- | ----------------------------- |
| None | —         | —      | —          | No WebGL                      |
| Low  | 1-2 cores | ≤2 GB  | 2g         | Software renderer             |
| Mid  | 3-4 cores | 2-4 GB | 3g, 4g     | Integrated / older discrete   |
| High | 5+ cores  | >4 GB  | high       | RTX, RX 5000+, Apple M-series |

## Rendering Hints

Based on device tiers, the middleware provides boolean rendering hints:

- `deferHeavyComponents` — Delay loading expensive UI components
- `serveMinimalCSS` — Send reduced stylesheets
- `reduceAnimations` — Disable or simplify animations
- `useImagePlaceholders` — Show placeholders instead of full images
- `preferServerRendering` — Favor SSR over client-side rendering
- `disable3dEffects` — Disable WebGL/3D content (no GPU or software renderer)
- `limitVideoQuality` — Serve lower resolution video, skip HD streams
- `useSystemFonts` — Skip loading custom web fonts
- `disablePrefetch` — Don't speculatively fetch resources
