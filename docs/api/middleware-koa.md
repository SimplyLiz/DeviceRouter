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

| Option        | Type                                   | Default                  | Description                                        |
| ------------- | -------------------------------------- | ------------------------ | -------------------------------------------------- |
| `storage`     | `StorageAdapter`                       | required                 | Storage backend                                    |
| `cookieName`  | `string`                               | `'dr_session'`           | Session cookie name                                |
| `cookiePath`  | `string`                               | `'/'`                    | Cookie path                                        |
| `ttl`         | `number`                               | `86400`                  | Profile TTL in seconds                             |
| `rejectBots`  | `boolean`                              | `true`                   | Reject bot/crawler probe submissions (returns 403) |
| `thresholds`  | `TierThresholds`                       | built-in defaults        | Custom tier classification thresholds              |
| `injectProbe` | `boolean`                              | `false`                  | Auto-inject probe script into HTML responses       |
| `probePath`   | `string`                               | `'/device-router/probe'` | Custom probe endpoint path for injected script     |
| `probeNonce`  | `string \| ((ctx: Context) => string)` | —                        | CSP nonce for the injected script tag              |

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

## Requirements

- A JSON body parser must be applied before the probe endpoint (Koa does not include one by default)
- `@device-router/probe` must be installed when using `injectProbe: true`
