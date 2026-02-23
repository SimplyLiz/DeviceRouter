# @device-router/middleware-fastify

Fastify plugin for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter). Adds device classification and rendering hints to every request.

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
const { plugin, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

await app.register(cookie);
await app.register(plugin);

app.post('/device-router/probe', probeEndpoint);

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
2. **Plugin** registers a `preHandler` hook that reads the session cookie, loads the profile from storage, and attaches it to `req.deviceProfile`
3. Your route handlers use `req.deviceProfile.hints` and `req.deviceProfile.tiers` to adapt responses

## Probe auto-injection

Automatically inject the probe `<script>` into HTML responses:

```typescript
const { plugin, probeEndpoint, injectionHook } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  injectProbe: true,
  probeNonce: 'my-csp-nonce', // optional
});
```

When `injectProbe` is enabled, the plugin registers an `onSend` hook that injects the script before `</head>`.

## Custom thresholds

```typescript
const { plugin, probeEndpoint } = createDeviceRouter({
  storage,
  thresholds: {
    cpu: { lowUpperBound: 4, midUpperBound: 8 },
    memory: { midUpperBound: 8 },
  },
});
```

## Options

| Option                | Type                                          | Default           | Description                                   |
| --------------------- | --------------------------------------------- | ----------------- | --------------------------------------------- |
| `storage`             | `StorageAdapter`                              | _(required)_      | Storage backend for profiles                  |
| `cookieName`          | `string`                                      | `'dr_session'`    | Session cookie name                           |
| `cookiePath`          | `string`                                      | `'/'`             | Cookie path                                   |
| `cookieSecure`        | `boolean`                                     | `false`           | Set `Secure` flag on the session cookie       |
| `ttl`                 | `number`                                      | `86400` (24h)     | Profile TTL in seconds                        |
| `rejectBots`          | `boolean`                                     | `true`            | Reject bot/crawler probe submissions          |
| `thresholds`          | `TierThresholds`                              | Built-in defaults | Custom tier thresholds (validated at startup) |
| `injectProbe`         | `boolean`                                     | `false`           | Auto-inject probe into HTML                   |
| `probePath`           | `string`                                      | —                 | Custom probe endpoint path                    |
| `probeNonce`          | `string \| ((req: FastifyRequest) => string)` | —                 | CSP nonce for injected script                 |
| `fallbackProfile`     | `FallbackProfile`                             | —                 | Fallback profile for first requests           |
| `classifyFromHeaders` | `boolean`                                     | `false`           | Classify from UA/Client Hints                 |

## Exports

- `createDeviceRouter(options)` — All-in-one setup returning `{ plugin, probeEndpoint, injectionHook? }`
- `createMiddleware(options)` — Standalone preHandler hook
- `createProbeEndpoint(options)` — Standalone probe endpoint handler
- `createInjectionHook(options)` — Standalone onSend injection hook

## Compatibility

- Fastify 5.x
- `@fastify/cookie` 11.x
- Node.js >= 20

## License

MIT
