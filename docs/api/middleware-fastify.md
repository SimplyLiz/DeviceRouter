# @device-router/middleware-fastify API

## createDeviceRouter(options)

Factory that creates the Fastify middleware and probe endpoint.

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
```

### Options

| Option                | Type                                          | Default                  | Description                                                               |
| --------------------- | --------------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `storage`             | `StorageAdapter`                              | required                 | Storage backend                                                           |
| `cookieName`          | `string`                                      | `'dr_session'`           | Session cookie name                                                       |
| `cookiePath`          | `string`                                      | `'/'`                    | Cookie path                                                               |
| `cookieSecure`        | `boolean`                                     | `false`                  | Set `Secure` flag on the session cookie                                   |
| `ttl`                 | `number`                                      | `86400`                  | Profile TTL in seconds                                                    |
| `rejectBots`          | `boolean`                                     | `true`                   | Reject bot/crawler probe submissions (returns 403)                        |
| `thresholds`          | `TierThresholds`                              | built-in defaults        | Custom tier classification thresholds (validated at startup)              |
| `injectProbe`         | `boolean`                                     | `false`                  | Auto-inject probe script into HTML responses                              |
| `probePath`           | `string`                                      | `'/device-router/probe'` | Custom probe endpoint path for injected script                            |
| `probeNonce`          | `string \| ((req: FastifyRequest) => string)` | —                        | CSP nonce for the injected script tag                                     |
| `fallbackProfile`     | `FallbackProfile`                             | —                        | Fallback profile for first requests without probe data                    |
| `classifyFromHeaders` | `boolean`                                     | `false`                  | Classify from UA/Client Hints on first request                            |
| `onEvent`             | `OnEventCallback`                             | —                        | Observability callback for logging/metrics ([guide](../observability.md)) |

### Returns

| Property              | Type                         | Description                                                  |
| --------------------- | ---------------------------- | ------------------------------------------------------------ |
| `middleware`          | Fastify plugin               | Registers `preHandler` hook (and `onSend` hook if injecting) |
| `probeEndpoint`       | Fastify route handler        | Handles `POST` from probe, validates and stores signals      |
| `injectionMiddleware` | `onSend` hook or `undefined` | Only present when `injectProbe: true`                        |

## req.deviceProfile

The middleware attaches a `ClassifiedProfile | null` to `req.deviceProfile`:

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

When `injectProbe: true`, the middleware registers an `onSend` hook that automatically injects the probe `<script>` into HTML responses. Requires `@device-router/probe` to be installed.

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage,
  injectProbe: true,
  probeNonce: 'my-nonce', // or (req) => req.headers['x-nonce']
});
```

The script is injected before `</head>`, falling back to `</body>`. JSON and other non-HTML responses pass through unmodified.

## Standalone Functions

The individual pieces can be used independently for more granular control.

### loadProbeScript(options?)

Reads and returns the minified probe script. Use this with `createInjectionMiddleware()` when you need probe injection without the full factory.

```typescript
import { loadProbeScript } from '@device-router/middleware-fastify';

const probeScript = loadProbeScript();
// or with a custom endpoint path:
const probeScript = loadProbeScript({ probePath: '/custom/probe' });
```

| Option      | Type     | Default | Description                                                 |
| ----------- | -------- | ------- | ----------------------------------------------------------- |
| `probePath` | `string` | —       | Custom probe endpoint path (rewrites the URL in the script) |

### createMiddleware(options)

Creates the `preHandler` hook independently. Thresholds are validated at creation time.

```typescript
import { createMiddleware } from '@device-router/middleware-fastify';

const hook = createMiddleware({
  storage,
  thresholds: { cpu: { lowUpperBound: 4, midUpperBound: 8 } },
});

app.addHook('preHandler', hook);
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
import { createProbeEndpoint } from '@device-router/middleware-fastify';

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

Creates the `onSend` injection hook independently. Pair with `loadProbeScript()` to load the probe bundle.

```typescript
import { createInjectionMiddleware, loadProbeScript } from '@device-router/middleware-fastify';

const injection = createInjectionMiddleware({
  probeScript: loadProbeScript({ probePath: '/api/probe' }),
  nonce: 'my-csp-nonce',
});

app.addHook('onSend', injection);
```

#### InjectOptions

| Option        | Type                                          | Default      | Description                       |
| ------------- | --------------------------------------------- | ------------ | --------------------------------- |
| `probeScript` | `string`                                      | _(required)_ | The minified probe script source  |
| `nonce`       | `string \| ((req: FastifyRequest) => string)` | —            | CSP nonce for the injected script |

### Standalone quickstart

Use the pieces independently when you need fine-grained control:

```typescript
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import {
  createMiddleware,
  createProbeEndpoint,
  createInjectionMiddleware,
  loadProbeScript,
} from '@device-router/middleware-fastify';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = Fastify();
const storage = new MemoryStorageAdapter();

await app.register(cookie);

// Each piece is configured independently
const hook = createMiddleware({ storage });
const endpoint = createProbeEndpoint({ storage, ttl: 3600 });
const injection = createInjectionMiddleware({
  probeScript: loadProbeScript(),
});

app.addHook('preHandler', hook);
app.addHook('onSend', injection);
app.post('/device-router/probe', endpoint);

app.get('/', (req, reply) => {
  const profile = req.deviceProfile;
  reply.send({ tiers: profile?.tiers });
});

app.listen({ port: 3000 });
```

## Requirements

- `@fastify/cookie` must be registered before the DeviceRouter middleware
- `@device-router/probe` must be installed when using `injectProbe: true`
