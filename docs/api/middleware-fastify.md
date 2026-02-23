# @device-router/middleware-fastify API

## createDeviceRouter(options)

Factory that creates the Fastify plugin and probe endpoint.

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createDeviceRouter } from '@device-router/middleware-fastify';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = Fastify();
await app.register(cookie);

const { plugin, pluginOptions, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.post('/device-router/probe', probeEndpoint);
await app.register(plugin, pluginOptions);
```

### Options

| Option                | Type                                          | Default                  | Description                                            |
| --------------------- | --------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `storage`             | `StorageAdapter`                              | required                 | Storage backend                                        |
| `cookieName`          | `string`                                      | `'dr_session'`           | Session cookie name                                    |
| `cookiePath`          | `string`                                      | `'/'`                    | Cookie path                                            |
| `ttl`                 | `number`                                      | `86400`                  | Profile TTL in seconds                                 |
| `rejectBots`          | `boolean`                                     | `true`                   | Reject bot/crawler probe submissions (returns 403)     |
| `thresholds`          | `TierThresholds`                              | built-in defaults        | Custom tier classification thresholds                  |
| `injectProbe`         | `boolean`                                     | `false`                  | Auto-inject probe script into HTML responses           |
| `probePath`           | `string`                                      | `'/device-router/probe'` | Custom probe endpoint path for injected script         |
| `probeNonce`          | `string \| ((req: FastifyRequest) => string)` | —                        | CSP nonce for the injected script tag                  |
| `fallbackProfile`     | `FallbackProfile`                             | —                        | Fallback profile for first requests without probe data |
| `classifyFromHeaders` | `boolean`                                     | `false`                  | Classify from UA/Client Hints on first request         |

### Returns

| Property        | Type                         | Description                                                     |
| --------------- | ---------------------------- | --------------------------------------------------------------- |
| `plugin`        | Fastify plugin               | Registers `preHandler` hook (and `onSend` hook if injecting)    |
| `pluginOptions` | `object`                     | Options object to pass to `app.register(plugin, pluginOptions)` |
| `probeEndpoint` | Fastify route handler        | Handles `POST` from probe, validates and stores signals         |
| `injectionHook` | `onSend` hook or `undefined` | Only present when `injectProbe: true`                           |

## req.deviceProfile

The plugin attaches a `ClassifiedProfile | null` to `req.deviceProfile`:

```typescript
interface ClassifiedProfile {
  profile: DeviceProfile; // Raw profile with signals
  tiers: DeviceTiers; // { cpu, memory, connection, gpu }
  hints: RenderingHints; // { deferHeavyComponents, ... }
  source: ProfileSource; // 'probe' | 'headers' | 'fallback'
}
```

`null` when no session cookie is present or profile has expired (unless `classifyFromHeaders` or `fallbackProfile` is configured).

## Probe Auto-Injection

When `injectProbe: true`, the plugin registers an `onSend` hook that automatically injects the probe `<script>` into HTML responses. Requires `@device-router/probe` to be installed.

```typescript
const { plugin, pluginOptions, probeEndpoint } = createDeviceRouter({
  storage,
  injectProbe: true,
  probeNonce: 'my-nonce', // or (req) => req.headers['x-nonce']
});
```

The script is injected before `</head>`, falling back to `</body>`. JSON and other non-HTML responses pass through unmodified.

## Requirements

- `@fastify/cookie` must be registered before the DeviceRouter plugin
- `@device-router/probe` must be installed when using `injectProbe: true`
