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

| Option                | Type                                 | Default                  | Description                                                               |
| --------------------- | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------- |
| `storage`             | `StorageAdapter`                     | required                 | Storage backend                                                           |
| `cookieName`          | `string`                             | `'dr_session'`           | Session cookie name                                                       |
| `cookiePath`          | `string`                             | `'/'`                    | Cookie path                                                               |
| `cookieSecure`        | `boolean`                            | `false`                  | Set `Secure` flag on the session cookie                                   |
| `ttl`                 | `number`                             | `86400`                  | Profile TTL in seconds                                                    |
| `rejectBots`          | `boolean`                            | `true`                   | Reject bot/crawler probe submissions (returns 403)                        |
| `thresholds`          | `TierThresholds`                     | built-in defaults        | Custom tier classification thresholds (validated at startup)              |
| `injectProbe`         | `boolean`                            | `false`                  | Auto-inject probe script into HTML responses                              |
| `probePath`           | `string`                             | `'/device-router/probe'` | Custom probe endpoint path for injected script                            |
| `probeNonce`          | `string \| ((c: Context) => string)` | —                        | CSP nonce for the injected script tag                                     |
| `fallbackProfile`     | `FallbackProfile`                    | —                        | Fallback profile for first requests without probe data                    |
| `classifyFromHeaders` | `boolean`                            | `false`                  | Classify from UA/Client Hints on first request                            |
| `onEvent`             | `OnEventCallback`                    | —                        | Observability callback for logging/metrics ([guide](../observability.md)) |

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

## Standalone Functions

The individual pieces can be used independently for more granular control.

### loadProbeScript(options?)

Reads and returns the minified probe script. Use this with `createInjectionMiddleware()` when you need probe injection without the full factory.

```typescript
import { loadProbeScript } from '@device-router/middleware-hono';

const probeScript = loadProbeScript();
// or with a custom endpoint path:
const probeScript = loadProbeScript({ probePath: '/custom/probe' });
```

| Option      | Type     | Default | Description                                                 |
| ----------- | -------- | ------- | ----------------------------------------------------------- |
| `probePath` | `string` | —       | Custom probe endpoint path (rewrites the URL in the script) |

### createMiddleware(options)

Creates the Hono middleware independently. Thresholds are validated at creation time.

```typescript
import { createMiddleware } from '@device-router/middleware-hono';

const middleware = createMiddleware({
  storage,
  thresholds: { cpu: { lowUpperBound: 4, midUpperBound: 8 } },
});

app.use('*', middleware);
```

#### MiddlewareOptions

| Option                | Type              | Default        | Description                                    |
| --------------------- | ----------------- | -------------- | ---------------------------------------------- |
| `storage`             | `StorageAdapter`  | _(required)_   | Storage backend for profiles                   |
| `cookieName`          | `string`          | `'dr_session'` | Session cookie name                            |
| `thresholds`          | `TierThresholds`  | Built-in       | Custom tier thresholds (validated at creation) |
| `fallbackProfile`     | `FallbackProfile` | —              | Fallback profile for first requests            |
| `classifyFromHeaders` | `boolean`         | `false`        | Classify from UA/Client Hints on first request |
| `onEvent`             | `OnEventCallback` | —              | Observability callback                         |

### createProbeEndpoint(options)

Creates the probe POST handler independently.

```typescript
import { createProbeEndpoint } from '@device-router/middleware-hono';

const endpoint = createProbeEndpoint({
  storage,
  ttl: 3600,
  rejectBots: true,
});

app.post('/device-router/probe', endpoint);
```

#### EndpointOptions

| Option         | Type              | Default        | Description                          |
| -------------- | ----------------- | -------------- | ------------------------------------ |
| `storage`      | `StorageAdapter`  | _(required)_   | Storage backend for profiles         |
| `cookieName`   | `string`          | `'dr_session'` | Session cookie name                  |
| `cookiePath`   | `string`          | `'/'`          | Cookie path                          |
| `cookieSecure` | `boolean`         | `false`        | Set `Secure` flag on the cookie      |
| `ttl`          | `number`          | `86400`        | Profile TTL in seconds               |
| `rejectBots`   | `boolean`         | `true`         | Reject bot/crawler probe submissions |
| `onEvent`      | `OnEventCallback` | —              | Observability callback               |

### createInjectionMiddleware(options)

Creates the probe script injection middleware independently. Pair with `loadProbeScript()` to load the probe bundle.

```typescript
import { createInjectionMiddleware, loadProbeScript } from '@device-router/middleware-hono';

const injection = createInjectionMiddleware({
  probeScript: loadProbeScript({ probePath: '/api/probe' }),
  nonce: 'my-csp-nonce',
});

app.use('*', injection);
```

#### InjectOptions

| Option        | Type                                 | Default      | Description                       |
| ------------- | ------------------------------------ | ------------ | --------------------------------- |
| `probeScript` | `string`                             | _(required)_ | The minified probe script source  |
| `nonce`       | `string \| ((c: Context) => string)` | —            | CSP nonce for the injected script |

### Standalone quickstart

Use the pieces independently when you need fine-grained control:

```typescript
import { Hono } from 'hono';
import {
  createMiddleware,
  createProbeEndpoint,
  createInjectionMiddleware,
  loadProbeScript,
} from '@device-router/middleware-hono';
import type { DeviceRouterEnv } from '@device-router/middleware-hono';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Hono<DeviceRouterEnv>();
const storage = new MemoryStorageAdapter();

// Each piece is configured independently
const middleware = createMiddleware({ storage });
const endpoint = createProbeEndpoint({ storage, ttl: 3600 });
const injection = createInjectionMiddleware({
  probeScript: loadProbeScript(),
});

app.use('*', injection);
app.use('*', middleware);
app.post('/device-router/probe', endpoint);

app.get('/', (c) => {
  const profile = c.get('deviceProfile');
  return c.json({ tiers: profile?.tiers });
});

export default app;
```

## Requirements

- Hono uses built-in cookie helpers (`hono/cookie`) — no additional cookie package needed
- `@device-router/probe` must be installed when using `injectProbe: true`
