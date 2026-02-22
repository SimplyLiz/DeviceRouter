# DeviceRouter

Detect device capabilities server-side and enable tailored responses.

## Architecture

```
┌─────────┐     POST /probe     ┌──────────────────┐     ┌─────────┐
│  Browser │ ──────────────────> │  Express Server   │ ──> │  Redis  │
│  (Probe) │                    │  (Middleware)      │     │ Storage │
└─────────┘                    └──────────────────┘     └─────────┘
                                        │
                                        ▼
                                ┌──────────────────┐
                                │  req.deviceProfile │
                                │  { tiers, hints } │
                                └──────────────────┘
```

The lightweight client-side probe (<1 KB gzipped) collects device signals and submits them to your server. The Express middleware classifies the device into capability tiers and attaches rendering hints to every request.

## Packages

| Package | Description |
|---------|-------------|
| `@device-router/types` | Device profile types, tier classification, rendering hints |
| `@device-router/probe` | Client-side capability probe (~1 KB gzipped) |
| `@device-router/storage` | Storage adapters (in-memory, Redis) |
| `@device-router/middleware-express` | Express middleware and probe endpoint |

## Quick Start

```bash
pnpm add @device-router/middleware-express @device-router/storage
```

```typescript
import express from 'express';
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = express();
const { middleware, probeEndpoint } = createDeviceRouter({
  storage: new MemoryStorageAdapter(),
});

app.use(express.json());
app.post('/device-router/probe', probeEndpoint);
app.use(middleware);

app.get('/', (req, res) => {
  const profile = req.deviceProfile;
  if (profile?.tiers.cpu === 'low') {
    res.send('Lightweight page');
  } else {
    res.send('Full experience');
  }
});
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Profile Schema Reference](docs/profile-schema.md)
- API Reference:
  - [@device-router/types](docs/api/types.md)
  - [@device-router/probe](docs/api/probe.md)
  - [@device-router/storage](docs/api/storage.md)
  - [@device-router/middleware-express](docs/api/middleware-express.md)

## Development

```bash
git clone <repo-url>
cd DeviceRouter
pnpm install
pnpm build
pnpm test
```

## License

MIT
