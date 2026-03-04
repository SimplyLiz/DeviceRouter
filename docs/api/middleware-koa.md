# @device-router/middleware-koa API

## createDeviceRouter(options)

Factory that creates the Koa middleware and probe endpoint.

```typescript
import Koa from 'koa';
import { createDeviceRouter } from '@device-router/middleware-koa';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Koa();

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

// Route probe endpoint manually (or use koa-router)
app.use(async (ctx, next) => {
  if (ctx.path === '/device-router/probe' && ctx.method === 'POST') {
    await probeEndpoint(ctx);
    return;
  }
  await next();
});

app.use(middleware);
```

### Options

| Option                | Type                                   | Default                   | Description                                                               |
| --------------------- | -------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `storage`             | `StorageAdapter`                       | required                  | Storage backend                                                           |
| `cookieName`          | `string`                               | `'device-router-session'` | Session cookie name                                                       |
| `cookiePath`          | `string`                               | `'/'`                     | Cookie path                                                               |
| `cookieSecure`        | `boolean`                              | `false`                   | Set `Secure` flag on the session cookie                                   |
| `ttl`                 | `number`                               | `86400`                   | Profile TTL in seconds                                                    |
| `rejectBots`          | `boolean`                              | `true`                    | Reject bot/crawler probe submissions (returns 403)                        |
| `thresholds`          | `TierThresholds`                       | built-in defaults         | Custom tier classification thresholds (validated at startup)              |
| `injectProbe`         | `boolean`                              | `false`                   | Auto-inject probe script into HTML responses                              |
| `probePath`           | `string`                               | `'/device-router/probe'`  | Custom probe endpoint path for injected script                            |
| `probeNonce`          | `string \| ((ctx: Context) => string)` | —                         | CSP nonce for the injected script tag                                     |
| `fallbackProfile`     | `FallbackProfile`                      | —                         | Fallback profile for first requests without probe data                    |
| `classifyFromHeaders` | `boolean`                              | `false`                   | Classify from UA/Client Hints on first request                            |
| `onEvent`             | `OnEventCallback`                      | —                         | Observability callback for logging/metrics ([guide](../observability.md)) |

### Returns

| Property              | Type                              | Description                                                      |
| --------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `middleware`          | Koa middleware                    | Reads session, classifies device, sets `ctx.state.deviceProfile` |
| `probeEndpoint`       | `(ctx: Context) => Promise<void>` | Handles probe POST, validates and stores signals                 |
| `injectionMiddleware` | Koa middleware or `undefined`     | Only present when `injectProbe: true`                            |

## ctx.state.deviceProfile

The middleware attaches a `ClassifiedProfile | null` to `ctx.state.deviceProfile`:

```typescript
app.use(async (ctx) => {
  const profile = ctx.state.deviceProfile;
  if (profile?.hints.deferHeavyComponents) {
    ctx.body = renderLite();
  }
});
```

## Probe Auto-Injection

When `injectProbe: true`, a middleware is returned that after `await next()` checks `ctx.type` for HTML and mutates `ctx.body` to include the probe script.

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
});

// Register injection middleware before route handlers
if (injectionMiddleware) {
  app.use(injectionMiddleware);
}
app.use(middleware);
```

## Standalone Functions

The individual pieces can be used independently for more granular control.

### loadProbeScript(options?)

Reads and returns the minified probe script. Use this with `createInjectionMiddleware()` when you need probe injection without the full factory.

```typescript
import { loadProbeScript } from '@device-router/middleware-koa';

const probeScript = loadProbeScript();
// or with a custom endpoint path:
const probeScript = loadProbeScript({ probePath: '/custom/probe' });
```

| Option      | Type     | Default | Description                                                 |
| ----------- | -------- | ------- | ----------------------------------------------------------- |
| `probePath` | `string` | —       | Custom probe endpoint path (rewrites the URL in the script) |

### createMiddleware(options)

Creates the Koa middleware independently. Thresholds are validated at creation time.

```typescript
import { createMiddleware } from '@device-router/middleware-koa';

const middleware = createMiddleware({
  storage,
  thresholds: { cpu: { lowUpperBound: 4, midUpperBound: 8 } },
});

app.use(middleware);
```

#### MiddlewareOptions

| Option                | Type              | Default                   | Description                                    |
| --------------------- | ----------------- | ------------------------- | ---------------------------------------------- |
| `storage`             | `StorageAdapter`  | _(required)_              | Storage backend for profiles                   |
| `cookieName`          | `string`          | `'device-router-session'` | Session cookie name                            |
| `thresholds`          | `TierThresholds`  | Built-in                  | Custom tier thresholds (validated at creation) |
| `fallbackProfile`     | `FallbackProfile` | —                         | Fallback profile for first requests            |
| `classifyFromHeaders` | `boolean`         | `false`                   | Classify from UA/Client Hints on first request |
| `onEvent`             | `OnEventCallback` | —                         | Observability callback                         |

### createProbeEndpoint(options)

Creates the probe POST handler independently.

```typescript
import { createProbeEndpoint } from '@device-router/middleware-koa';

const endpoint = createProbeEndpoint({
  storage,
  ttl: 3600,
  rejectBots: true,
});

// Route manually or with koa-router
app.use(async (ctx, next) => {
  if (ctx.path === '/device-router/probe' && ctx.method === 'POST') {
    await endpoint(ctx);
    return;
  }
  await next();
});
```

#### EndpointOptions

| Option         | Type              | Default                   | Description                          |
| -------------- | ----------------- | ------------------------- | ------------------------------------ |
| `storage`      | `StorageAdapter`  | _(required)_              | Storage backend for profiles         |
| `cookieName`   | `string`          | `'device-router-session'` | Session cookie name                  |
| `cookiePath`   | `string`          | `'/'`                     | Cookie path                          |
| `cookieSecure` | `boolean`         | `false`                   | Set `Secure` flag on the cookie      |
| `ttl`          | `number`          | `86400`                   | Profile TTL in seconds               |
| `rejectBots`   | `boolean`         | `true`                    | Reject bot/crawler probe submissions |
| `onEvent`      | `OnEventCallback` | —                         | Observability callback               |

### createInjectionMiddleware(options)

Creates the probe script injection middleware independently. Pair with `loadProbeScript()` to load the probe bundle.

```typescript
import { createInjectionMiddleware, loadProbeScript } from '@device-router/middleware-koa';

const injection = createInjectionMiddleware({
  probeScript: loadProbeScript({ probePath: '/api/probe' }),
  nonce: 'my-csp-nonce',
});

app.use(injection);
```

#### InjectOptions

| Option        | Type                                   | Default      | Description                       |
| ------------- | -------------------------------------- | ------------ | --------------------------------- |
| `probeScript` | `string`                               | _(required)_ | The minified probe script source  |
| `nonce`       | `string \| ((ctx: Context) => string)` | —            | CSP nonce for the injected script |

### Standalone quickstart

Use the pieces independently when you need fine-grained control:

```typescript
import Koa from 'koa';
import {
  createMiddleware,
  createProbeEndpoint,
  createInjectionMiddleware,
  loadProbeScript,
} from '@device-router/middleware-koa';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = new Koa();
const storage = new MemoryStorageAdapter();

// Each piece is configured independently
const middleware = createMiddleware({ storage });
const endpoint = createProbeEndpoint({ storage, ttl: 3600 });
const injection = createInjectionMiddleware({
  probeScript: loadProbeScript(),
});

app.use(injection);

app.use(async (ctx, next) => {
  if (ctx.path === '/device-router/probe' && ctx.method === 'POST') {
    await endpoint(ctx);
    return;
  }
  await next();
});

app.use(middleware);

app.use(async (ctx) => {
  const profile = ctx.state.deviceProfile;
  ctx.body = { tiers: profile?.tiers };
});

app.listen(3000);
```

## Requirements

- A JSON body parser must be applied before the probe endpoint (Koa does not include one by default)
- `@device-router/probe` must be installed when using `injectProbe: true`
