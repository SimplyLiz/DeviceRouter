# @device-router/middleware-fastify

Fastify middleware for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter). Adds device classification and rendering hints to every request.

## Installation

```bash
pnpm add @device-router/middleware-fastify @device-router/storage @fastify/cookie
```

For automatic probe injection:

```bash
pnpm add @device-router/probe
```

## Quick start

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createDeviceRouter } from '@device-router/middleware-fastify';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = Fastify();
const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

await app.register(cookie);

app.post('/device-router/probe', probeEndpoint);
app.addHook('preHandler', middleware);

app.get('/', (req, reply) => {
  const profile = req.deviceProfile;

  if (profile?.hints.preferServerRendering) {
    return reply.send(renderSSR());
  }
  if (profile?.hints.deferHeavyComponents) {
    return reply.send(renderLite());
  }
  reply.send(renderFull());
});

app.listen({ port: 3000 });
```

## How it works

1. **Probe endpoint** receives device signals from the browser and stores a classified profile
2. **Middleware** is a `preHandler` hook that reads the session cookie, loads the profile from storage, and attaches it to `req.deviceProfile`
3. Your route handlers use `req.deviceProfile.hints` and `req.deviceProfile.tiers` to adapt responses

## Probe auto-injection

Automatically inject the probe `<script>` into HTML responses:

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  injectProbe: true,
  probeNonce: 'my-csp-nonce', // optional
});
```

When `injectProbe` is enabled, `injectionMiddleware` is returned as an `onSend` hook. Register it to inject the script before `</head>`:

```typescript
app.addHook('preHandler', middleware);
if (injectionMiddleware) {
  app.addHook('onSend', injectionMiddleware);
}
```

> **Streaming responses:** The `onSend` hook receives the serialized payload as a string. If you stream responses via `reply.raw`, the hook is bypassed and injection is skipped. Add the probe `<script>` tag to your HTML shell manually instead.

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

| Option                | Type                                          | Default                   | Description                                   |
| --------------------- | --------------------------------------------- | ------------------------- | --------------------------------------------- |
| `storage`             | `StorageAdapter`                              | _(required)_              | Storage backend for profiles                  |
| `cookieName`          | `string`                                      | `'device-router-session'` | Session cookie name                           |
| `cookiePath`          | `string`                                      | `'/'`                     | Cookie path                                   |
| `cookieSecure`        | `boolean`                                     | `false`                   | Set `Secure` flag on the session cookie       |
| `ttl`                 | `number`                                      | `86400` (24h)             | Profile TTL in seconds                        |
| `rejectBots`          | `boolean`                                     | `true`                    | Reject bot/crawler probe submissions          |
| `thresholds`          | `TierThresholds`                              | Built-in defaults         | Custom tier thresholds (validated at startup) |
| `injectProbe`         | `boolean`                                     | `false`                   | Auto-inject probe into HTML                   |
| `probePath`           | `string`                                      | —                         | Custom probe endpoint path                    |
| `probeNonce`          | `string \| ((req: FastifyRequest) => string)` | —                         | CSP nonce for injected script                 |
| `fallbackProfile`     | `FallbackProfile`                             | —                         | Fallback profile for first requests           |
| `classifyFromHeaders` | `boolean`                                     | `false`                   | Classify from UA/Client Hints                 |
| `onEvent`             | `OnEventCallback`                             | —                         | Observability callback for logging/metrics    |

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
} from '@device-router/middleware-fastify';

// Use only what you need
const hook = createMiddleware({ storage, thresholds });
const endpoint = createProbeEndpoint({ storage, ttl: 3600 });
const injection = createInjectionMiddleware({
  probeScript: loadProbeScript(),
});

app.addHook('preHandler', hook);
app.addHook('onSend', injection);
app.post('/device-router/probe', endpoint);
```

`loadProbeScript()` reads the `@device-router/probe` bundle and optionally rewrites the endpoint URL via `{ probePath }`. Thresholds passed to `createMiddleware()` are validated at creation time.

## Exports

- `createDeviceRouter(options)` — All-in-one setup returning `{ middleware, probeEndpoint, injectionMiddleware? }`
- `createMiddleware(options)` — Standalone preHandler hook (validates thresholds)
- `createProbeEndpoint(options)` — Standalone probe endpoint handler
- `createInjectionMiddleware(options)` — Standalone onSend injection hook
- `loadProbeScript(options?)` — Load the minified probe script for use with `createInjectionMiddleware()`

## Compatibility

- Fastify 5.x
- `@fastify/cookie` 11.x
- Node.js >= 20

## License

MIT
