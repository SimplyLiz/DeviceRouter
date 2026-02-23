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

| Option                | Type                                   | Default                  | Description                                                  |
| --------------------- | -------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| `storage`             | `StorageAdapter`                       | required                 | Storage backend                                              |
| `cookieName`          | `string`                               | `'dr_session'`           | Session cookie name                                          |
| `cookiePath`          | `string`                               | `'/'`                    | Cookie path                                                  |
| `ttl`                 | `number`                               | `86400`                  | Profile TTL in seconds                                       |
| `rejectBots`          | `boolean`                              | `true`                   | Reject bot/crawler probe submissions (returns 403)           |
| `thresholds`          | `TierThresholds`                       | built-in defaults        | Custom tier classification thresholds (validated at startup) |
| `injectProbe`         | `boolean`                              | `false`                  | Auto-inject probe script into HTML responses                 |
| `probePath`           | `string`                               | `'/device-router/probe'` | Custom probe endpoint path for injected script               |
| `probeNonce`          | `string \| ((req: Request) => string)` | —                        | CSP nonce for the injected script tag                        |
| `fallbackProfile`     | `FallbackProfile`                      | —                        | Fallback profile for first requests without probe data       |
| `classifyFromHeaders` | `boolean`                              | `false`                  | Classify from UA/Client Hints on first request               |

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

## Requirements

- `cookie-parser` middleware must be applied before the DeviceRouter middleware
- `express.json()` middleware must be applied before the probe endpoint
- `@device-router/probe` must be installed when using `injectProbe: true`
