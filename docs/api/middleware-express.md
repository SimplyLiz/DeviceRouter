# @device-router/middleware-express API

## createDeviceRouter(options)

Factory that creates the middleware and probe endpoint.

```typescript
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
  cookieName: 'dr_session',    // Default
  cookiePath: '/',              // Default
  ttl: 86400,                   // Default: 24 hours
});

app.post('/device-router/probe', probeEndpoint);
app.use(middleware);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storage` | `StorageAdapter` | required | Storage backend |
| `cookieName` | `string` | `'dr_session'` | Session cookie name |
| `cookiePath` | `string` | `'/'` | Cookie path |
| `ttl` | `number` | `86400` | Profile TTL in seconds |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `middleware` | Express middleware | Reads session, classifies device, attaches `req.deviceProfile` |
| `probeEndpoint` | Express handler | Handles `POST` from probe, validates and stores signals |

## req.deviceProfile

The middleware attaches a `ClassifiedProfile | null` to `req.deviceProfile`:

```typescript
interface ClassifiedProfile {
  profile: DeviceProfile;    // Raw profile with signals
  tiers: DeviceTiers;        // { cpu, memory, connection }
  hints: RenderingHints;     // { deferHeavyComponents, ... }
}
```

`null` when no session cookie is present or profile has expired.

## Requirements

- `cookie-parser` middleware must be applied before the DeviceRouter middleware
- `express.json()` middleware must be applied before the probe endpoint
