# @device-router/middleware-koa

Koa middleware for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter). Adds device classification and rendering hints to every request.

## Installation

```bash
pnpm add @device-router/middleware-koa @device-router/storage
```

For automatic probe injection:

```bash
pnpm add @device-router/probe
```

## Quick start

```typescript
import Koa from 'koa';
import { createDeviceRouter } from '@device-router/middleware-koa';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Koa();
const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.use(middleware);

app.use(async (ctx) => {
  if (ctx.method === 'POST' && ctx.path === '/device-router/probe') {
    return probeEndpoint(ctx);
  }

  const profile = ctx.state.deviceProfile;

  if (profile?.hints.preferServerRendering) {
    ctx.body = renderSSR();
  } else if (profile?.hints.deferHeavyComponents) {
    ctx.body = renderLite();
  } else {
    ctx.body = renderFull();
  }
});

app.listen(3000);
```

## How it works

1. **Probe endpoint** receives device signals from the browser and stores a classified profile
2. **Middleware** reads the session cookie, loads the profile from storage, and attaches it to `ctx.state.deviceProfile`
3. Your route handlers use `ctx.state.deviceProfile.hints` and `ctx.state.deviceProfile.tiers` to adapt responses

## Probe auto-injection

Automatically inject the probe `<script>` into HTML responses:

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  injectProbe: true,
  probeNonce: 'my-csp-nonce', // optional
});

app.use(injectionMiddleware); // before routes
app.use(middleware);
```

> **Streaming responses:** Injection only runs when `ctx.body` is a string. If you set `ctx.body` to a `Stream`, injection is silently skipped. Add the probe `<script>` tag to your HTML shell manually instead.

## Custom thresholds

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  thresholds: {
    cpu: { lowUpperBound: 4, midUpperBound: 8 },
    memory: { midUpperBound: 8 },
  },
});
```

## Options

| Option                | Type                                   | Default                   | Description                                   |
| --------------------- | -------------------------------------- | ------------------------- | --------------------------------------------- |
| `storage`             | `StorageAdapter`                       | _(required)_              | Storage backend for profiles                  |
| `cookieName`          | `string`                               | `'device-router-session'` | Session cookie name                           |
| `cookiePath`          | `string`                               | `'/'`                     | Cookie path                                   |
| `cookieSecure`        | `boolean`                              | `false`                   | Set `Secure` flag on the session cookie       |
| `ttl`                 | `number`                               | `86400` (24h)             | Profile TTL in seconds                        |
| `rejectBots`          | `boolean`                              | `true`                    | Reject bot/crawler probe submissions          |
| `thresholds`          | `TierThresholds`                       | Built-in defaults         | Custom tier thresholds (validated at startup) |
| `injectProbe`         | `boolean`                              | `false`                   | Auto-inject probe into HTML                   |
| `probePath`           | `string`                               | —                         | Custom probe endpoint path                    |
| `probeNonce`          | `string \| ((ctx: Context) => string)` | —                         | CSP nonce for injected script                 |
| `fallbackProfile`     | `FallbackProfile`                      | —                         | Fallback profile for first requests           |
| `classifyFromHeaders` | `boolean`                              | `false`                   | Classify from UA/Client Hints                 |
| `onEvent`             | `OnEventCallback`                      | —                         | Observability callback for logging/metrics    |

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

See the [Observability guide](https://github.com/SimplyLiz/DeviceRouter/blob/main/docs/observability.md) for details.

## Standalone usage

Use the individual pieces when you need fine-grained control over each component:

```typescript
import {
  createMiddleware,
  createProbeEndpoint,
  createInjectionMiddleware,
  loadProbeScript,
} from '@device-router/middleware-koa';

// Use only what you need
const middleware = createMiddleware({ storage, thresholds });
const endpoint = createProbeEndpoint({ storage, ttl: 3600 });
const injection = createInjectionMiddleware({
  probeScript: loadProbeScript(),
});

app.use(injection);
app.use(middleware);
```

`loadProbeScript()` reads the `@device-router/probe` bundle and optionally rewrites the endpoint URL via `{ probePath }`. Thresholds passed to `createMiddleware()` are validated at creation time.

## Exports

- `createDeviceRouter(options)` — All-in-one setup returning `{ middleware, probeEndpoint, injectionMiddleware? }`
- `createMiddleware(options)` — Standalone middleware (validates thresholds)
- `createProbeEndpoint(options)` — Standalone probe endpoint handler
- `createInjectionMiddleware(options)` — Standalone injection middleware
- `loadProbeScript(options?)` — Load the minified probe script for use with `createInjectionMiddleware()`

## Compatibility

- Koa 2.x and 3.x
- Node.js >= 20

## License

MIT
