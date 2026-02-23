# @device-router/middleware-express

Express middleware for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter). Adds device classification and rendering hints to every request.

## Installation

```bash
pnpm add @device-router/middleware-express @device-router/storage cookie-parser
```

For automatic probe injection:

```bash
pnpm add @device-router/probe
```

## Quick start

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = express();
const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.use(express.json());
app.use(cookieParser());
app.post('/device-router/probe', probeEndpoint);
app.use(middleware);

app.get('/', (req, res) => {
  const profile = req.deviceProfile;

  if (profile?.hints.preferServerRendering) {
    return res.send(renderSSR());
  }
  if (profile?.hints.deferHeavyComponents) {
    return res.send(renderLite());
  }
  res.send(renderFull());
});

app.listen(3000);
```

## How it works

1. **Probe endpoint** receives device signals from the browser and stores a classified profile
2. **Middleware** reads the session cookie, loads the profile from storage, and attaches it to `req.deviceProfile`
3. Your route handlers use `req.deviceProfile.hints` and `req.deviceProfile.tiers` to adapt responses

## Probe auto-injection

Automatically inject the probe `<script>` into HTML responses before `</head>`:

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  injectProbe: true,
  probeNonce: 'my-csp-nonce', // optional, for Content-Security-Policy
});

app.use(injectionMiddleware); // before routes
app.post('/device-router/probe', probeEndpoint);
app.use(middleware);
```

## Custom thresholds

Override default tier classification boundaries:

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

| Option                | Type                                   | Default           | Description                                   |
| --------------------- | -------------------------------------- | ----------------- | --------------------------------------------- |
| `storage`             | `StorageAdapter`                       | _(required)_      | Storage backend for profiles                  |
| `cookieName`          | `string`                               | `'dr_session'`    | Session cookie name                           |
| `cookiePath`          | `string`                               | `'/'`             | Cookie path                                   |
| `ttl`                 | `number`                               | `86400` (24h)     | Profile TTL in seconds                        |
| `rejectBots`          | `boolean`                              | `true`            | Reject bot/crawler probe submissions          |
| `probePath`           | `string`                               | —                 | Custom probe endpoint path                    |
| `thresholds`          | `TierThresholds`                       | Built-in defaults | Custom tier thresholds (validated at startup) |
| `injectProbe`         | `boolean`                              | `false`           | Auto-inject probe into HTML                   |
| `probeNonce`          | `string \| ((req: Request) => string)` | —                 | CSP nonce for injected script                 |
| `fallbackProfile`     | `FallbackProfile`                      | —                 | Fallback profile for first requests           |
| `classifyFromHeaders` | `boolean`                              | `false`           | Classify from UA/Client Hints                 |

## Exports

- `createDeviceRouter(options)` — All-in-one setup returning `{ middleware, probeEndpoint, injectionMiddleware? }`
- `createMiddleware(options)` — Standalone middleware
- `createProbeEndpoint(options)` — Standalone probe endpoint handler
- `createInjectionMiddleware(options)` — Standalone probe injection middleware

## Prerequisites

- [`cookie-parser`](https://www.npmjs.com/package/cookie-parser) — required for session cookie handling (`req.cookies`)

## Compatibility

- Express 4.x and 5.x
- Node.js >= 20

## License

MIT
