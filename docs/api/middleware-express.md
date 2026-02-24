# @device-router/middleware-express API

## createDeviceRouter(options)

Factory that creates the middleware and probe endpoint.

```typescript
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  cookieName: 'dr_session', // Default
  cookiePath: '/', // Default
  ttl: 86400, // Default: 24 hours
});

app.post('/device-router/probe', probeEndpoint);
app.use(middleware);
```

### Options

| Option                | Type                                   | Default                  | Description                                                               |
| --------------------- | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `storage`             | `StorageAdapter`                       | required                 | Storage backend                                                           |
| `cookieName`          | `string`                               | `'dr_session'`           | Session cookie name                                                       |
| `cookiePath`          | `string`                               | `'/'`                    | Cookie path                                                               |
| `cookieSecure`        | `boolean`                              | `false`                  | Set `Secure` flag on the session cookie                                   |
| `ttl`                 | `number`                               | `86400`                  | Profile TTL in seconds                                                    |
| `rejectBots`          | `boolean`                              | `true`                   | Reject bot/crawler probe submissions (returns 403)                        |
| `thresholds`          | `TierThresholds`                       | built-in defaults        | Custom tier classification thresholds (validated at startup)              |
| `injectProbe`         | `boolean`                              | `false`                  | Auto-inject probe script into HTML responses                              |
| `probePath`           | `string`                               | `'/device-router/probe'` | Custom probe endpoint path for injected script                            |
| `probeNonce`          | `string \| ((req: Request) => string)` | —                        | CSP nonce for the injected script tag                                     |
| `fallbackProfile`     | `FallbackProfile`                      | —                        | Fallback profile for first requests without probe data                    |
| `classifyFromHeaders` | `boolean`                              | `false`                  | Classify from UA/Client Hints on first request                            |
| `onEvent`             | `OnEventCallback`                      | —                        | Observability callback for logging/metrics ([guide](../observability.md)) |

### Returns

| Property              | Type                              | Description                                                    |
| --------------------- | --------------------------------- | -------------------------------------------------------------- |
| `middleware`          | Express middleware                | Reads session, classifies device, attaches `req.deviceProfile` |
| `probeEndpoint`       | Express handler                   | Handles `POST` from probe, validates and stores signals        |
| `injectionMiddleware` | Express middleware or `undefined` | Only present when `injectProbe: true`                          |

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

When `injectProbe: true`, `injectionMiddleware` is returned. Register it before your routes to auto-inject the probe `<script>` into HTML responses.

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
  probeNonce: 'my-nonce',
});

app.post('/device-router/probe', probeEndpoint);
if (injectionMiddleware) {
  app.use(injectionMiddleware);
}
app.use(middleware);
```

The script is injected before `</head>`, falling back to `</body>`. JSON and other non-HTML responses pass through unmodified.

**Note:** Injection intercepts `res.send()`. Streaming responses (`res.write()`) are not intercepted — serve the probe script tag manually in streamed HTML.

## Standalone Functions

The individual pieces can be used independently for more granular control.

### loadProbeScript(options?)

Reads and returns the minified probe script. Use this with `createInjectionMiddleware()` when you need probe injection without the full factory.

```typescript
import { loadProbeScript } from '@device-router/middleware-express';

const probeScript = loadProbeScript();
// or with a custom endpoint path:
const probeScript = loadProbeScript({ probePath: '/custom/probe' });
```

| Option      | Type     | Default | Description                                                 |
| ----------- | -------- | ------- | ----------------------------------------------------------- |
| `probePath` | `string` | —       | Custom probe endpoint path (rewrites the URL in the script) |

### createMiddleware(options)

Creates the classification middleware independently. Thresholds are validated at creation time.

```typescript
import { createMiddleware } from '@device-router/middleware-express';

const middleware = createMiddleware({
  storage,
  thresholds: { cpu: { lowUpperBound: 4, midUpperBound: 8 } },
  classifyFromHeaders: true,
});

app.use(middleware);
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
import { createProbeEndpoint } from '@device-router/middleware-express';

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
import { createInjectionMiddleware, loadProbeScript } from '@device-router/middleware-express';

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
| `nonce`       | `string \| ((req: Request) => string)` | —            | CSP nonce for the injected script |

### Standalone quickstart

Use the pieces independently when you need fine-grained control:

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import {
  createMiddleware,
  createProbeEndpoint,
  createInjectionMiddleware,
  loadProbeScript,
} from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = express();
const storage = new MemoryStorageAdapter();

app.use(express.json());
app.use(cookieParser());

// Each piece is configured independently
const middleware = createMiddleware({ storage });
const endpoint = createProbeEndpoint({ storage, ttl: 3600 });
const injection = createInjectionMiddleware({
  probeScript: loadProbeScript(),
});

app.use(injection);
app.post('/device-router/probe', endpoint);
app.use(middleware);

app.get('/', (req, res) => {
  const profile = req.deviceProfile;
  res.json({ tiers: profile?.tiers });
});

app.listen(3000);
```

## Requirements

- `cookie-parser` middleware must be applied before the DeviceRouter middleware
- `express.json()` middleware must be applied before the probe endpoint
- `@device-router/probe` must be installed when using `injectProbe: true`
