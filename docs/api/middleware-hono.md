# @device-router/middleware-hono API

## createDeviceRouter(options)

Factory that creates the Hono middleware and probe endpoint.

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
```

### Options

| Option        | Type                                 | Default                  | Description                                        |
| ------------- | ------------------------------------ | ------------------------ | -------------------------------------------------- |
| `storage`     | `StorageAdapter`                     | required                 | Storage backend                                    |
| `cookieName`  | `string`                             | `'dr_session'`           | Session cookie name                                |
| `cookiePath`  | `string`                             | `'/'`                    | Cookie path                                        |
| `ttl`         | `number`                             | `86400`                  | Profile TTL in seconds                             |
| `rejectBots`  | `boolean`                            | `true`                   | Reject bot/crawler probe submissions (returns 403) |
| `thresholds`  | `TierThresholds`                     | built-in defaults        | Custom tier classification thresholds              |
| `injectProbe` | `boolean`                            | `false`                  | Auto-inject probe script into HTML responses       |
| `probePath`   | `string`                             | `'/device-router/probe'` | Custom probe endpoint path for injected script     |
| `probeNonce`  | `string \| ((c: Context) => string)` | —                        | CSP nonce for the injected script tag              |

### Returns

| Property              | Type                           | Description                                                     |
| --------------------- | ------------------------------ | --------------------------------------------------------------- |
| `middleware`          | Hono middleware                | Reads session, classifies device, sets `deviceProfile` variable |
| `probeEndpoint`       | Hono handler                   | Handles `POST` from probe, validates and stores signals         |
| `injectionMiddleware` | Hono middleware or `undefined` | Only present when `injectProbe: true`                           |

## c.get('deviceProfile')

The middleware sets a `ClassifiedProfile | null` on the Hono context:

```typescript
app.get('/', (c) => {
  const profile = c.get('deviceProfile');
  // ...
});
```

## DeviceRouterEnv

Type your Hono app with `DeviceRouterEnv` for type-safe access to `deviceProfile`:

```typescript
import type { DeviceRouterEnv } from '@device-router/middleware-hono';

const app = new Hono<DeviceRouterEnv>();
```

## Probe Auto-Injection

When `injectProbe: true`, a middleware is returned that intercepts HTML responses after `next()` and injects the probe `<script>`. Uses Web API `Response` replacement — edge-safe, no Node.js-specific APIs at runtime.

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
});

// Register injection middleware before other middleware
if (injectionMiddleware) {
  app.use('*', injectionMiddleware);
}
app.use('*', middleware);
```

**Note:** `fs.readFileSync` is called once at initialization to load the probe bundle. At runtime, only Web APIs are used.

## Requirements

- Hono uses built-in cookie helpers (`hono/cookie`) — no additional cookie package needed
- `@device-router/probe` must be installed when using `injectProbe: true`
