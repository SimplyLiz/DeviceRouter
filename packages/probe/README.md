# @device-router/probe

A ~1 KB (gzipped) client-side probe that collects device capability signals via browser APIs for [DeviceRouter](https://github.com/SimplyLiz/DeviceRouter).

## Installation

```bash
pnpm add @device-router/probe
```

## How it works

The probe runs once per session in the browser. It collects device signals using standard browser APIs, then POSTs them to your server's probe endpoint. A session cookie prevents repeated collection.

```
Browser                          Server
  │                                │
  │  collectSignals()              │
  │  getBattery()                  │
  │                                │
  │  POST /device-router/probe     │
  │  ─────────────────────────>    │
  │  { hardwareConcurrency: 8,     │
  │    deviceMemory: 8, ... }      │
  │                                │
  │  { sessionToken: "abc123" }    │
  │  <─────────────────────────    │
  │                                │
  │  Set cookie: dr_session=abc123 │
  └────────────────────────────────┘
```

## Usage

### Script tag (IIFE)

The simplest approach — include the pre-built bundle:

```html
<script src="/device-router-probe.min.js"></script>
```

The probe auto-executes on load. Serve the file from `dist/device-router-probe.min.js`.

### Auto-injection

Middleware packages can auto-inject the probe into HTML responses:

```typescript
const { middleware, probeEndpoint, injectionMiddleware } = createDeviceRouter({
  storage,
  injectProbe: true,
});
```

### Programmatic

```typescript
import { runProbe } from '@device-router/probe';

await runProbe({
  endpoint: '/device-router/probe', // default
  cookieName: 'dr_session', // default
  cookiePath: '/', // default
});
```

## Signals collected

| Signal                 | API                        | Browser Support     |
| ---------------------- | -------------------------- | ------------------- |
| CPU cores              | `hardwareConcurrency`      | All modern browsers |
| Device memory          | `deviceMemory`             | Chromium            |
| Connection info        | `navigator.connection`     | Chromium            |
| User agent             | `navigator.userAgent`      | All browsers        |
| Viewport dimensions    | `window.innerWidth/Height` | All browsers        |
| Pixel ratio            | `devicePixelRatio`         | All browsers        |
| Prefers reduced motion | `matchMedia`               | All modern browsers |
| Color scheme           | `matchMedia`               | All modern browsers |
| GPU renderer           | WebGL debug info           | Most browsers       |
| Battery status         | `navigator.getBattery()`   | Chromium            |

All signals are optional — the probe gracefully degrades based on what the browser supports. Unavailable APIs are silently skipped.

## Bundle size

The IIFE bundle is strictly capped at **1024 bytes gzipped**. This is enforced at build time — the build fails if the limit is exceeded.

## Exports

- `runProbe(options?)` — Run the probe (async, idempotent per session)
- `collectSignals()` — Collect all synchronous device signals
- `ProbeSignals` — Type for the collected signal object
- `ProbeOptions` — Configuration type for `runProbe`

Individual collectors are also exported for selective use:

- `collectHardwareConcurrency()`
- `collectDeviceMemory()`
- `collectConnection()`
- `collectUserAgent()`
- `collectViewport()`
- `collectPixelRatio()`
- `collectPrefersReducedMotion()`
- `collectPrefersColorScheme()`
- `collectGpuRenderer()`

## License

MIT
