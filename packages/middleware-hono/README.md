# @device-router/middleware-hono

Hono middleware for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter). Adds device classification and rendering hints to every request. Edge-compatible.

## Installation

```bash
pnpm add @device-router/middleware-hono @device-router/storage
```

For automatic probe injection:

```bash
pnpm add @device-router/probe
```

## Quick start

```typescript
import { Hono } from 'hono';
import { createDeviceRouter } from '@device-router/middleware-hono';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Hono();
const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.use('*', middleware);
app.post('/device-router/probe', probeEndpoint);

app.get('/', (c) => {
  const profile = c.get('deviceProfile');

  if (profile?.hints.preferServerRendering) {
    return c.html(renderSSR());
  }
  if (profile?.hints.deferHeavyComponents) {
    return c.html(renderLite());
  }
  return c.html(renderFull());
});

export default app;
```

## How it works

1. **Probe endpoint** receives device signals from the browser and stores a classified profile
2. **Middleware** reads the session cookie, loads the profile from storage, and sets it on the Hono context via `c.set('deviceProfile', profile)`
3. Your route handlers use `c.get('deviceProfile')` to access tiers and hints

## Probe auto-injection

Automatically inject the probe `<script>` into HTML responses:

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  injectProbe: true,
  probeNonce: 'my-csp-nonce', // optional
});

app.use('*', injectionMiddleware);
```

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

| Option                | Type                                 | Default           | Description                         |
| --------------------- | ------------------------------------ | ----------------- | ----------------------------------- |
| `storage`             | `StorageAdapter`                     | _(required)_      | Storage backend for profiles        |
| `cookieName`          | `string`                             | `'dr_session'`    | Session cookie name                 |
| `cookiePath`          | `string`                             | `'/'`             | Cookie path                         |
| `ttl`                 | `number`                             | `86400` (24h)     | Profile TTL in seconds              |
| `thresholds`          | `TierThresholds`                     | Built-in defaults | Custom tier thresholds              |
| `injectProbe`         | `boolean`                            | `false`           | Auto-inject probe into HTML         |
| `probePath`           | `string`                             | —                 | Custom probe endpoint path          |
| `probeNonce`          | `string \| ((c: Context) => string)` | —                 | CSP nonce for injected script       |
| `fallbackProfile`     | `FallbackProfile`                    | —                 | Fallback profile for first requests |
| `classifyFromHeaders` | `boolean`                            | `false`           | Classify from UA/Client Hints       |

## Type-safe context

Use the `DeviceRouterEnv` type for full type safety:

```typescript
import type { DeviceRouterEnv } from '@device-router/middleware-hono';

const app = new Hono<DeviceRouterEnv>();
// c.get('deviceProfile') is now typed
```

## Exports

- `createDeviceRouter(options)` — All-in-one setup returning `{ middleware, probeEndpoint, injectionMiddleware? }`
- `createMiddleware(options)` — Standalone middleware
- `createProbeEndpoint(options)` — Standalone probe endpoint handler
- `createInjectionMiddleware(options)` — Standalone injection middleware
- `DeviceRouterEnv` — Hono env type for typed context access

## Compatibility

- Hono 4.x
- Node.js >= 20, edge runtimes

## License

MIT
