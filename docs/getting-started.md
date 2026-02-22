# Getting Started

## Installation

```bash
pnpm add @device-router/middleware-express @device-router/storage
```

## Basic Setup

### 1. Create the middleware

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { createDeviceRouter } from '@device-router/middleware-express';
import { MemoryStorageAdapter } from '@device-router/storage';

const app = express();

app.use(cookieParser());
app.use(express.json());

const storage = new MemoryStorageAdapter();
const { middleware, probeEndpoint } = createDeviceRouter({ storage });

// Register the probe endpoint
app.post('/device-router/probe', probeEndpoint);

// Apply the middleware
app.use(middleware);
```

### 2. Add the probe script to your HTML

```html
<script src="/path/to/device-router-probe.min.js"></script>
```

The probe script (~762 bytes gzipped) runs once per session. It collects device signals and POSTs them to the probe endpoint.

### 3. Use device profile in your routes

```typescript
app.get('/', (req, res) => {
  const profile = req.deviceProfile;

  if (!profile) {
    // First visit — probe hasn't run yet
    res.send('Loading...');
    return;
  }

  if (profile.tiers.cpu === 'low') {
    res.send('Lightweight page');
  } else {
    res.send('Full experience');
  }
});
```

## Configuration

```typescript
const { middleware, probeEndpoint } = createDeviceRouter({
  storage, // Required: StorageAdapter instance
  cookieName: 'dr_session', // Default: 'dr_session'
  cookiePath: '/', // Default: '/'
  ttl: 86400, // Default: 86400 (24 hours)
  probePath: '/device-router/probe', // Default: '/device-router/probe'
});
```

## Using Redis Storage

```typescript
import Redis from 'ioredis';
import { RedisStorageAdapter } from '@device-router/storage';

const redis = new Redis();
const storage = new RedisStorageAdapter({
  client: redis,
  keyPrefix: 'dr:profile:', // Default prefix
});
```

## Device Tiers

The middleware classifies devices into tiers based on collected signals:

| Tier | CPU       | Memory | Connection |
| ---- | --------- | ------ | ---------- |
| Low  | 1-2 cores | ≤2 GB  | 2g         |
| Mid  | 3-4 cores | 2-4 GB | 3g, 4g     |
| High | 5+ cores  | >4 GB  | fast       |

## Rendering Hints

Based on device tiers, the middleware provides boolean rendering hints:

- `deferHeavyComponents` — Delay loading expensive UI components
- `serveMinimalCSS` — Send reduced stylesheets
- `reduceAnimations` — Disable or simplify animations
- `useImagePlaceholders` — Show placeholders instead of full images
- `disableAutoplay` — Prevent auto-playing media
- `preferServerRendering` — Favor SSR over client-side rendering
