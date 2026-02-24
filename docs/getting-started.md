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
await app.register(middleware);

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
    connection: { downlink4gUpperBound: 10 },
  },
});
```

Thresholds are validated at startup — inverted bounds, non-positive values, or non-RegExp GPU patterns throw immediately with a descriptive error. Partial thresholds are merged with defaults before validation, so ordering is checked against the full resolved config.

> **Note:** Changing thresholds does not re-classify profiles already stored from a previous deploy. See [Profile versioning](deployment.md#profile-versioning) in the Deployment Guide for strategies to handle threshold changes.

## Configuration

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,              // Required: StorageAdapter instance
  cookieName: 'dr_session',   // Default: 'dr_session'
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

DeviceRouter collects device capability signals (CPU cores, memory, GPU renderer, viewport, connection type, battery status, user agent) and links them to a session cookie. Depending on your jurisdiction, this has regulatory implications.

### Collected signals and fingerprinting

The signals DeviceRouter collects overlap with known browser fingerprinting vectors. Regulators evaluate the _capability_ of the data to identify users, not just the stated intent. Even though DeviceRouter uses these signals solely for adaptive rendering, the combination of GPU renderer, hardware concurrency, device memory, viewport, and user agent can narrow down device identity — and regulators treat that as personal data.

### EU: GDPR and ePrivacy Directive

Two regulations apply independently:

- **ePrivacy Directive (Article 5(3))** covers both setting the `dr_session` cookie _and_ reading device signals from browser APIs. Both count as accessing information stored on terminal equipment. The "strictly necessary" exemption is interpreted narrowly by the EDPB, CNIL, and ICO — it requires that the service _cannot function_ without the data, not that it functions _better_ with it. Adaptive rendering has not been recognized as strictly necessary by any regulator.

- **GDPR** applies because the collected signals in aggregate constitute personal data (Recital 30 explicitly references device identifiers and the profiles they can create). You need a lawful basis under Article 6 — consent (Article 6(1)(a)) is the most defensible option.

**In practice:** implement a cookie consent mechanism before deploying DeviceRouter in the EU.

### UK

The UK GDPR and PECR follow the same framework as the EU. The ICO has been particularly vocal about fingerprinting-like techniques — treat the requirements as equivalent.

### California (CCPA/CPRA)

The collected signals qualify as personal information under CCPA. You must:

- Disclose the collection in your privacy notice (notice at collection)
- Honor access and deletion requests for stored profiles
- If you never sell or share the data with third parties, the "Do Not Sell" opt-out does not apply, but the data is still subject to consumer rights

### Brazil (LGPD)

The ANPD treats cookie and fingerprinting data as personal data. Consent must be "free, informed and unequivocal." There is no "strictly necessary" carve-out equivalent to the ePrivacy Directive.

### Recommendations

- Obtain consent before loading the probe script in jurisdictions that require it
- Include DeviceRouter's signal collection in your privacy policy
- Set a reasonable TTL — shorter sessions reduce the regulatory surface
- Use `MemoryStorageAdapter` or configure Redis key expiration so profiles are not retained beyond their useful life
- Consider omitting high-entropy signals you do not need (e.g., if you only need CPU/memory tiers, you may not need `gpuRenderer` or `battery`)

> **Note:** This section is informational guidance, not legal advice. Consult a qualified privacy professional for your specific deployment.

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
